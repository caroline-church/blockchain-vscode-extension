/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
*/

'use strict';

import { IFabricEnvironmentConnection } from './IFabricEnvironmentConnection';
import * as Client from 'fabric-client';
import { PackageRegistryEntry } from '../packages/PackageRegistryEntry';
import * as fs from 'fs-extra';
import { FabricEnvironmentConnection } from './FabricEnvironmentConnection';
import Long = require('long');

export class Fabric2RuntimeConnection extends FabricEnvironmentConnection implements IFabricEnvironmentConnection {

    public async installChaincode(packageRegistryEntry: PackageRegistryEntry, peerName: string): Promise<void> {
        try {
            const peer: Client.Peer = this.getPeer(peerName);
            await this.setNodeContext(peerName);

            const pkgBuffer: Buffer = await fs.readFile(packageRegistryEntry.path);
            const installRequest: Client.ChaincodeInstallRequest = {
                target: peer,
                txId: this.client.newTransactionID()
            };

            const chaincode: Client.Chaincode = this.client['newChaincode'](packageRegistryEntry.name, packageRegistryEntry.version);
            chaincode.setPackage(pkgBuffer);

            // TODO this needs to move to approve when SDK updates
            const policyDef: any = {
                identities: [
                    { role: { name: 'member', mspId: 'org1' } }
                ],
                policy: {
                    '1-of': [{ 'signed-by': 0 }]
                }
            };

            chaincode.setEndorsementPolicyDefinition(policyDef);

            await chaincode.install(installRequest);
        } catch (error) {
            console.log(error);
        }
    }

    public async instantiateChaincode(name: string, version: string, peerNames: Array<string>, channelName: string, fcn: string, args: Array<string>, collectionPath: string): Promise<Buffer> {
        await this.approveChaincode(name, version, peerNames, channelName);
        await this.commitChaincode(name, version, peerNames, channelName);
        return this.initSmartContract(name, peerNames, channelName, fcn, args);
    }

    public async upgradeChaincode(name: string, version: string, peerNames: Array<string>, channelName: string, fcn: string, args: Array<string>, collectionPath: string): Promise<Buffer> {
        await this.approveChaincode(name, version, peerNames, channelName);
        await this.commitChaincode(name, version, peerNames, channelName);
        return this.initSmartContract(name, peerNames, channelName, fcn, args);
    }

    public async approveChaincode(smartContractName: string, smartContractVersion: string, peerNames: Array<string>, channelName: string): Promise<void> {
        const peers: Array<Client.Peer> = peerNames.map((peerName: string) => this.getPeer(peerName));
        await this.setNodeContext(peerNames[0]);

        // TODO: this is assuming one channel might need to make it work for multiple channels
        const channel: Client.Channel = this.getOrCreateChannel(channelName);

        const chaincode: Client.Chaincode = await this.getChaincode(peerNames[0], channel, smartContractName, smartContractVersion);

        // TODO might not need this depending on design
        const approved: boolean = await this.isApproved(peerNames[0], channelName, chaincode);
        if (approved) {
            throw new Error('smart contract already approved');
        }

        const txId: Client.TransactionId = this.client.newTransactionID();

        const approveRequest: Client.ChaincodeRequest = {
            targets: peers,
            chaincode: chaincode,
            txId: txId
        };

        // send to the peer to be endorsed
        // TODO update this when have typescript defs
        const response: any = await channel.approveChaincodeForOrg(approveRequest);

        // Validate the proposal responses.
        this.validateResponses(response.proposalResponses);

        // Set up the channel event hub for this transaction.
        const { eventHub, eventHubPromise }: { eventHub: Client.ChannelEventHub; eventHubPromise: any; } = await this.getEventHub(channel, peers, txId, peerNames);

        const orderer: Client.Orderer = await this.getOrdererForChannel(peers, channel);

        const ordererRequest: Client.TransactionRequest = {
            proposalResponses: response.proposalResponses,
            proposal: response.proposal,
            orderer,
            txId
        };

        // send to the orderer to be committed
        const broadcastResponse: Client.BroadcastResponse = await channel.sendTransaction(ordererRequest);

        if (broadcastResponse.status !== 'SUCCESS') {
            eventHub.disconnect();
            throw new Error(`Failed to send peer responses for transaction ${txId.getTransactionID()} to orderer. Response status: ${broadcastResponse.status}`);
        }

        // Wait for the transaction to be committed to the ledger.
        await eventHubPromise;
    }

    public async commitChaincode(smartContractName: string, smartContractVersion: string, peerNames: Array<string>, channelName: string): Promise<void> {
        const peers: Array<Client.Peer> = peerNames.map((peerName: string) => this.getPeer(peerName));
        await this.setNodeContext(peerNames[0]);

        // TODO: this is assuming one channel might need to make it work for multiple channels
        const channel: Client.Channel = this.getOrCreateChannel(channelName);

        const chaincode: Client.Chaincode = await this.getChaincode(peerNames[0], channel, smartContractName, smartContractVersion);

        const approved: boolean = await this.isApproved(peerNames[0], channelName, chaincode);
        if (!approved) {
            throw new Error('smart contract not yet approved');
        }

        const txId: Client.TransactionId = this.client.newTransactionID();
        const commitRequest: Client.ChaincodeRequest = {
            targets: peers,
            chaincode: chaincode,
            txId: txId
        };

        // send to the peers to be endorsed
        const response: any = await channel.commitChaincode(commitRequest);

        // Validate the proposal responses.
        this.validateResponses(response.proposalResponses);

        // Set up the channel event hub for this transaction.
        const { eventHub, eventHubPromise }: { eventHub: Client.ChannelEventHub; eventHubPromise: any; } = await this.getEventHub(channel, peers, txId, peerNames);

        const orderer: Client.Orderer = await this.getOrdererForChannel(peers, channel);

        const ordererRequest: Client.TransactionRequest = {
            proposalResponses: response.proposalResponses,
            proposal: response.proposal,
            orderer,
            txId
        };

        // send to the orderer to be committed
        const broadcastResponse: Client.BroadcastResponse = await channel.sendTransaction(ordererRequest);

        if (broadcastResponse.status !== 'SUCCESS') {
            eventHub.disconnect();
            throw new Error(`Failed to send peer responses for transaction ${txId.getTransactionID()} to orderer. Response status: ${broadcastResponse.status}`);
        }

        await eventHubPromise;
    }

    public async initSmartContract(name: string, peerNames: Array<string>, channelName: string, fcn: string, args: Array<string>): Promise<Buffer> {

        // Locate all of the requested peer nodes.
        const peers: Array<Client.Peer> = peerNames.map((peerName: string) => this.getPeer(peerName));

        // Get the channel.
        const channel: Client.Channel = this.getOrCreateChannel(channelName);

        await this.setNodeContext(peerNames[0]);

        if (!fcn) {
            fcn = 'org.hyperledger.fabric:GetMetadata';
            args = [];
        }

        const txId: Client.TransactionId = this.client.newTransactionID();

        const initRequest: Client.ChaincodeInvokeRequest = {
            targets: peers,
            chaincodeId: name,
            fcn: fcn,
            args: args,
            txId: txId
        };

        const response: Client.ProposalResponseObject = await channel.sendTransactionProposal(initRequest, 30000);

        const payload: Buffer = this.validateResponses(response[0]);

        // Find the orderer for this channel.
        const orderer: Client.Orderer = await this.getOrdererForChannel(peers, channel);

        const ordererRequest: Client.TransactionRequest = {
            proposalResponses: response[0] as Array<Client.ProposalResponse>,
            proposal: response[1],
            txId,
            orderer
        };

        const broadcastResponse: Client.BroadcastResponse = await channel.sendTransaction(ordererRequest);

        // Check that the ordering service accepted the transaction.
        if (broadcastResponse.status !== 'SUCCESS') {
            throw new Error(`Failed to send peer responses for transaction ${txId.getTransactionID()} to orderer. Response status: ${broadcastResponse.status}`);
        }

        return payload;
    }

    public async getInstalledChaincode(peerName: string): Promise<Map<string, Array<string>>> {
        console.log('getInstalledChaincode', peerName);

        const installedChainCodes: Map<string, Array<string>> = new Map<string, Array<string>>();
        const chaincodes: Array<any> = await this.getAllInstalledChaincodes(peerName);

        for (const chaincode of chaincodes) {
            const details: Array<string> = chaincode.label.split('_');
            if (installedChainCodes.has(details[0])) {
                installedChainCodes.get(details[0]).push(details[1]);
            } else {
                installedChainCodes.set(details[0], [details[1]]);
            }
        }

        return installedChainCodes;

    }

    public async getInstantiatedChaincode(peerNames: Array<string>, channelName: string): Promise<Array<{ name: string, version: string }>> {

        // Locate all of the requested peer nodes.
        const peers: Array<Client.Peer> = peerNames.map((peerName: string) => this.getPeer(peerName));

        // Get the channel.
        const channel: Client.Channel = this.getOrCreateChannel(channelName);

        // Use the first peer to perform this query.
        await this.setNodeContext(peerNames[0]);

        const nameSpaceDefRequest: Client.QueryNamespaceDefinitionsRequest = {
            target: peers[0],
            txId: this.client.newTransactionID()
        };

        const result: any = await channel.queryNamespaceDefinitions(nameSpaceDefRequest);

        const chaincodeNames: Array<string> = Object.keys(result.namespaces);

        const smartContracts: Array<{ name: string, version: string }> = [];
        for (const name of chaincodeNames) {

            const chaincodeQueryDefRequest: Client.QueryChaincodeDefinitionRequest = {
                target: peers[0],
                chaincodeId: name,
                txId: this.client.newTransactionID()
            };

            const chaincode: Client.Chaincode = await channel.queryChaincodeDefinition(chaincodeQueryDefRequest);
            smartContracts.push({ name: name, version: chaincode.getVersion() });
        }

        return smartContracts;
    }

    private async getEventHub(channel: Client.Channel, peers: Client.Peer[], txId: Client.TransactionId, peerNames: string[]): Promise<{ eventHub: Client.ChannelEventHub, eventHubPromise: any }> {
        const eventHub: Client.ChannelEventHub = channel.newChannelEventHub(peers[0]);
        let eventReceived: boolean = false;
        await new Promise((resolve: any, reject: any): void => {
            eventHub.connect(null, (err: Error) => {
                // Doesn't matter if we received the event.
                if (err && !eventReceived) {
                    return reject(err);
                }
                resolve();
            });
        });

        const eventHubPromise: any = new Promise((resolve: any, reject: any): void => {
            eventHub.registerTxEvent(txId.getTransactionID(), (eventTxId: string, code: string, blockNumber: number): void => {
                eventReceived = true;
                if (code !== 'VALID') {
                    return reject(new Error(`Peer ${peerNames[0]} has rejected the transaction ${eventTxId} with code ${code} in block ${blockNumber}`));
                }
                resolve();
            }, (err: Error): void => {
                // Doesn't matter if we received the event.
                if (err && !eventReceived) {
                    return reject(err);
                }
            }, {
                    disconnect: true,
                    unregister: true
                });
        });

        return { eventHub, eventHubPromise };
    }

    private async getChaincode(peerName: string, channel: Client.Channel, smartContractName: string, smartContractVersion: string): Promise<Client.Chaincode> {
        const sequenceNumber: Long = await this.getSequenceNumber(peerName, smartContractName, channel);
        // TODO do we need to check all peers?
        const packageId: string = await this.getPackageId(peerName, smartContractName, smartContractVersion);

        // TODO update this when have new typescript defs
        const chaincode: Client.Chaincode = this.client.newChaincode(smartContractName, smartContractVersion);
        chaincode.setPackageId(packageId);
        chaincode.setSequence(sequenceNumber);

        return chaincode;
    }

    private async getSequenceNumber(peerName: string, smartContractName: string, channel: Client.Channel): Promise<Long> {
        const peer: Client.Peer = this.getPeer(peerName);
        let sequenceNumber: Long = new Long(1);
        try {
            const chaincodeQueryDefRequest: Client.QueryChaincodeDefinitionRequest = {
                target: peer,
                chaincodeId: smartContractName,
                txId: this.client.newTransactionID()
            };
            const existingChaincode: Client.Chaincode = await channel.queryChaincodeDefinition(chaincodeQueryDefRequest);
            // if we get here we are upgrading so need to up the seqence number
            sequenceNumber = existingChaincode.getSequence().add(1);
        } catch (error) {
            // TODO throw if not just cos cant find thing
        }
        return sequenceNumber;
    }

    private async isApproved(peerName: string, channelName: string, chaincode: Client.Chaincode): Promise<boolean> {
        const peer: Client.Peer = this.getPeer(peerName);
        await this.setNodeContext(peerName);

        const approvalStatusRequest: any = {
            target: peer,
            chaincode: chaincode,
            txId: this.client.newTransactionID()
        };

        // TODO: this is assuming one channel might need to make it work for multiple channels
        const channel: Client.Channel = this.getOrCreateChannel(channelName);

        // TODO update when have tyescript defs
        const result: any = await channel.queryApprovalStatus(approvalStatusRequest);
        const organisations: Array<string> = Object.keys(result.approved);
        const notApproved: Array<string> = organisations.filter((org: string) => {
            return result.approved[org] === false;
        });

        return notApproved.length === 0;
    }

    private validateResponses(proposalResponses: Array<Client.ProposalResponse | Client.ProposalErrorResponse>): Buffer {
        let payload: Buffer = null;
        const validProposalResponses: Client.ProposalResponse[] = [];
        for (const proposalResponse of proposalResponses) {
            if (proposalResponse instanceof Error) {
                throw proposalResponse;
            } else if (proposalResponse.response.status !== 200) {
                throw new Error(proposalResponse.response.message);
            } else if (proposalResponse.response.payload.length) {
                payload = proposalResponse.response.payload;
            }
            validProposalResponses.push(proposalResponse);
        }
        return payload;
    }

    private async getPackageId(peerName: string, smartContractName: string, smartContractVersion: string): Promise<string> {
        const smartContracts: Array<any> = await this.getAllInstalledChaincodes(peerName);

        const wantedSmartContract: any = smartContracts.find((smartContract: any) => {
            const details: Array<string> = smartContract.label.split('_');
            return details[0] === smartContractName && details[1] === smartContractVersion;
        });
        if (!wantedSmartContract) {
            throw new Error('No matching installed smart contract found to approve');
        }
        return wantedSmartContract.package_id;
    }

    private async getAllInstalledChaincodes(peerName: string): Promise<Array<any>> {
        try {
            const peer: Client.Peer = this.getPeer(peerName);
            await this.setNodeContext(peerName);

            const channels: Array<string> = await this.getAllChannelNamesForPeer(peerName);

            // TODO: this is assuming one channel might need to make it work for multiple channels
            const channel: Client.Channel = this.getOrCreateChannel(channels[0]);

            const installedChaincodeRequest: Client.QueryInstalledChaincodesRequest = {
                target: peer,
                txId: this.client.newTransactionID()
            };

            // TODO: fix this when typescript defs correct
            const chaincodes: Array<Client.QueryInstalledChaincodeResult> = await channel.queryInstalledChaincodes(installedChaincodeRequest);
            return chaincodes['installed_chaincodes'];
        } catch (error) {
            if (error.message && error.message.match(/access denied/)) {
                // Not allowed to do this as we're probably not an administrator.
                // This is probably not the end of the world, so return the empty map.
                return [];
            }
            throw error;
        }
    }
}
