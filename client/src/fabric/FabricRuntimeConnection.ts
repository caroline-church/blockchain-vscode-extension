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
import { FabricConnection } from './FabricConnection';
import { FabricRuntime } from './FabricRuntime';
import { PackageRegistryEntry } from '../packages/PackageRegistryEntry';

import * as Client from 'fabric-client';
import * as ClientCA from 'fabric-ca-client';
import * as fs from 'fs-extra';
import { OutputAdapter, LogType } from '../logging/OutputAdapter';
import { ConsoleOutputAdapter } from '../logging/ConsoleOutputAdapter';
import { IFabricRuntimeConnection } from './IFabricRuntimeConnection';
import { IFabricWallet } from './IFabricWallet';
import { FabricPeer } from './FabricPeer';
import { FabricCA } from './FabricCA';

export class FabricRuntimeConnection extends FabricConnection implements IFabricRuntimeConnection {

    private channelMap: Map<string, Client.Channel> = new Map<string, Client.Channel>();
    private outputAdapter: OutputAdapter;

    private runtime: FabricRuntime;

    private peers: Map<string, FabricPeer> = new Map<string, FabricPeer>();

    private cas: Map<string, FabricCA> = new Map<string, FabricCA>();

    private wallet: IFabricWallet;

    constructor(runtime: FabricRuntime, outputAdapter?: OutputAdapter) {
        super();

        this.runtime = runtime;

        if (!outputAdapter) {
            this.outputAdapter = ConsoleOutputAdapter.instance();
        } else {
            this.outputAdapter = outputAdapter;
        }
    }

    async initialize(): Promise<void> {
        console.log('FabricRuntimeConnection: connect');

        this.client = new Client();

        const channel: Client.Channel = this.client.newChannel('mychannel');
        this.channelMap.set('mychannel', channel);

        const otherChannel: Client.Channel = this.client.newChannel('otherchannel');
        this.channelMap.set('otherchannel', otherChannel);

        let peerOptions: Client.ConnectionOpts = { 'ssl-target-name-override': 'peer0.org1.example.com', 'pem': this.runtime.getPeerTLSCertificate('Org1MSP'), 'name': 'peer0.org1.example.com' };
        let peer: Client.Peer = this.client.newPeer('grpcs://localhost:7051', peerOptions);
        let fabricPeer: FabricPeer = new FabricPeer();
        fabricPeer.name = peer.getName();
        fabricPeer.org = 'Org1MSP';
        fabricPeer.peer = peer;
        fabricPeer.identityName = 'Admin@org1.example.com';
        this.peers.set(peer.getName(), fabricPeer);

        channel.addPeer(peer, 'Org1MSP');
        otherChannel.addPeer(peer, 'Org1MSP');

        peerOptions = { 'ssl-target-name-override': 'peer0.org2.example.com', 'pem': this.runtime.getPeerTLSCertificate('Org2MSP'), 'name': 'peer0.org2.example.com' };
        peer = this.client.newPeer('grpcs://localhost:8051', peerOptions);
        fabricPeer = new FabricPeer();
        fabricPeer.name = peer.getName();
        fabricPeer.org = 'Org2MSP';
        fabricPeer.peer = peer;
        fabricPeer.identityName = 'Admin@org2.example.com';
        this.peers.set(peer.getName(), fabricPeer);

        channel.addPeer(peer, 'Org2MSP');
        otherChannel.addPeer(peer, 'Org2MSP');

        const ordererOptions: Client.ConnectionOpts = { 'ssl-target-name-override': 'orderer.example.com', 'pem': this.runtime.getOrdererTLSCertificate(), 'name': 'orderer.example.com' };

        const order: Client.Orderer = this.client.newOrderer('grpcs://localhost:7050', ordererOptions);
        channel.addOrderer(order);

        let tlsOptions: ClientCA.TLSOptions = {
            trustedRoots: Buffer.from([this.runtime.getCACertificate('Org1MSP')]),
            verify: false
        };

        // Not sure this is right
        let ca: ClientCA = new ClientCA('https://localhost:7054', tlsOptions, 'ca.org1.example.com');
        const fabricCA: FabricCA = new FabricCA();
        fabricCA.ca = ca;
        fabricCA.identityName = 'Admin@org1.example.com';
        fabricCA.name = 'ca.org1.example.com';
        fabricCA.org = 'Org1MSP';
        this.cas.set('ca.org1.example.com', fabricCA);

        tlsOptions = {
            trustedRoots: Buffer.from([this.runtime.getCACertificate('Org2MSP')]),
            verify: false
        };

        // Not sure this is right
        ca = new ClientCA('https://localhost:8054', tlsOptions, 'ca.org2.example.com');
        const fabricCA2: FabricCA = new FabricCA();
        fabricCA2.ca = ca;
        fabricCA2.identityName = 'Admin@org2.example.com';
        fabricCA2.name = 'ca.org2.example.com';
        fabricCA2.org = 'Org2MSP';
        this.cas.set('ca.org2.example.com', fabricCA2);
    }

    public async connect(wallet: IFabricWallet, identityName: string): Promise<void> {
        if (!wallet && !this.wallet) {
            throw new Error('no wallet set');
        } else if (wallet) {
            this.wallet = wallet;
        }

        await this.wallet['setUserContext'](this.client, identityName);
        for (const channelThing of this.channelMap) {
            const channel: Client.Channel = channelThing[1];
            await channel.initialize();
        }
    }

    public async getAllChannelsForPeer(peerName: string): Promise<Array<string>> {
        const peer: FabricPeer = this.peers.get(peerName);
        await this.wallet['setUserContext'](this.client, peer.identityName);
        try {
            return super.getAllChannelsForPeerInner(peerName);
        } catch (error) {
            throw error;
        }
    }

    public getOrganizations(): Set<string> {
        // TODO: check this works when not all orgs are in every channel
        console.log('getOrganizations');
        const orgs: Set<string> = new Set();
        this.channelMap.forEach((channel: Client.Channel) => {
            const orgsArray: any[] = channel.getOrganizations();
            orgsArray.forEach((org: any) => {
                orgs.add(org.id);
            });
        });

        return orgs;
    }

    public getCertificateAuthorityNames(): Array<string> {
        return Array.from(this.cas.keys());
    }

    public async enroll(enrollmentID: string, enrollmentSecret: string, mspid: string): Promise<{ certificate: string, privateKey: string }> {
        let fabricCA: FabricCA;
        this.cas.forEach((value: FabricCA) => {
            if (value.org === mspid) {
                fabricCA = value;
            }
        });

        const certificateAuthority: ClientCA = fabricCA.ca;
        const enrollment: ClientCA.IEnrollResponse = await certificateAuthority.enroll({ enrollmentID, enrollmentSecret });
        return { certificate: enrollment.certificate, privateKey: enrollment.key.toBytes() };
    }

    public async getInstalledChaincode(peerName: string): Promise<Map<string, Array<string>>> {
        console.log('getInstalledChaincode', peerName);
        const fabricPeer: FabricPeer = this.peers.get(peerName);
        await this.wallet['setUserContext'](this.client, fabricPeer.identityName);
        const installedChainCodes: Map<string, Array<string>> = new Map<string, Array<string>>();
        const peer: Client.Peer = fabricPeer.peer;
        let chaincodeResponse: Client.ChaincodeQueryResponse;
        try {
            chaincodeResponse = await this.client.queryInstalledChaincodes(peer);
        } catch (error) {
            if (error.message && error.message.match(/access denied/)) {
                // Not allowed to do this as we're probably not an administrator.
                // This is probably not the end of the world, so return the empty map.
                return installedChainCodes;
            }
            throw error;
        }
        chaincodeResponse.chaincodes.forEach((chaincode: Client.ChaincodeInfo) => {
            if (installedChainCodes.has(chaincode.name)) {
                installedChainCodes.get(chaincode.name).push(chaincode.version);
            } else {
                installedChainCodes.set(chaincode.name, [chaincode.version]);
            }
        });

        return installedChainCodes;
    }

    public async installChaincode(packageRegistryEntry: PackageRegistryEntry, peerName: string): Promise<void> {
        const peer: Client.Peer = this.getPeer(peerName);
        const pkgBuffer: Buffer = await fs.readFile(packageRegistryEntry.path);
        const installRequest: Client.ChaincodePackageInstallRequest = {
            targets: [peer],
            chaincodePackage: pkgBuffer,
            txId: this.client.newTransactionID()
        };
        const response: Client.ProposalResponseObject = await this.client.installChaincode(installRequest);
        const proposalResponse: Client.ProposalResponse | Error = response[0][0];
        if (proposalResponse instanceof Error) {
            throw proposalResponse;
        } else if (proposalResponse.response.status !== 200) {
            throw new Error(proposalResponse.response.message);
        }
    }

    public async instantiateChaincode(name: string, version: string, channelName: string, fcn: string, args: Array<string>): Promise<any> {

        const transactionId: Client.TransactionId = this.client.newTransactionID();
        const instantiateRequest: Client.ChaincodeInstantiateUpgradeRequest = {
            chaincodeId: name,
            chaincodeVersion: version,
            txId: transactionId,
            fcn: fcn,
            args: args
        };

        const channel: Client.Channel = this.channelMap.get(channelName);

        const instantiatedChaincode: Array<any> = await this.getInstantiatedChaincode(channelName);

        const foundChaincode: any = this.getChaincode(name, instantiatedChaincode);

        let proposalResponseObject: Client.ProposalResponseObject;

        let message: string;

        if (foundChaincode) {
            throw new Error('The name of the contract you tried to instantiate is already instantiated');
        } else {
            message = `Instantiating with function: '${fcn}' and arguments: '${args}'`;
            this.outputAdapter.log(LogType.INFO, undefined, message);
            proposalResponseObject = await channel.sendInstantiateProposal(instantiateRequest);
        }

        // TODO: make this work

        // const contract: Contract = network.getContract(name);
        // const transaction: any = (contract as any).createTransaction('dummy');

        // const responses: any = transaction['_validatePeerResponses'](proposalResponseObject[0]);

        // const txId: any = transactionId.getTransactionID();
        // const eventHandlerOptions: any = (contract as any).getEventHandlerOptions();
        // const eventHandler: any = transaction['_createTxEventHandler'](txId, network, eventHandlerOptions);

        // if (!eventHandler) {
        //     throw new Error('Failed to create an event handler');
        // }

        // await eventHandler.startListening();

        // const transactionRequest: Client.TransactionRequest = {
        //     proposalResponses: proposalResponseObject[0] as Client.ProposalResponse[],
        //     proposal: proposalResponseObject[1],
        //     txId: transactionId
        // };

        // Submit the endorsed transaction to the primary orderers.
        // const response: Client.BroadcastResponse = await channel.sendTransaction(transactionRequest);

        // if (response.status !== 'SUCCESS') {
        //     const msg: string = `Failed to send peer responses for transaction ${transactionId.getTransactionID()} to orderer. Response status: ${response.status}`;
        //     eventHandler.cancelListening();
        //     throw new Error(msg);
        // }

        // await eventHandler.waitForEvents();
        // // return the payload from the invoked chaincode
        // let result: any = null;
        // if (responses && responses.validResponses[0].response.payload.length > 0) {
        //     result = responses.validResponses[0].response.payload;
        // }

        // eventHandler.cancelListening();

        // return result;
    }

    public async upgradeChaincode(name: string, version: string, channelName: string, fcn: string, args: Array<string>): Promise<any> {

        const transactionId: Client.TransactionId = this.client.newTransactionID();
        const upgradeRequest: Client.ChaincodeInstantiateUpgradeRequest = {
            chaincodeId: name,
            chaincodeVersion: version,
            txId: transactionId,
            fcn: fcn,
            args: args
        };

        // TODO: make this work

        // const network: Network = await this.gateway.getNetwork(channelName);
        // const channel: Client.Channel = network.getChannel();

        // const instantiatedChaincode: Array<any> = await this.getInstantiatedChaincode(channelName);

        // const foundChaincode: any = this.getChaincode(name, instantiatedChaincode);

        // let proposalResponseObject: Client.ProposalResponseObject;

        // let message: string;

        // if (foundChaincode) {
        //     message = `Upgrading with function: '${fcn}' and arguments: '${args}'`;
        //     this.outputAdapter.log(LogType.INFO, undefined, message);
        //     proposalResponseObject = await channel.sendUpgradeProposal(upgradeRequest);
        // } else {
        //     //
        //     throw new Error('The contract you tried to upgrade with has no previous versions instantiated');
        // }

        // const contract: Contract = network.getContract(name);
        // const transaction: any = (contract as any).createTransaction('dummy');

        // const responses: any = transaction['_validatePeerResponses'](proposalResponseObject[0]);

        // const txId: any = transactionId.getTransactionID();
        // const eventHandlerOptions: any = (contract as any).getEventHandlerOptions();
        // const eventHandler: any = transaction['_createTxEventHandler'](txId, network, eventHandlerOptions);

        // if (!eventHandler) {
        //     throw new Error('Failed to create an event handler');
        // }

        // await eventHandler.startListening();

        // const transactionRequest: Client.TransactionRequest = {
        //     proposalResponses: proposalResponseObject[0] as Client.ProposalResponse[],
        //     proposal: proposalResponseObject[1],
        //     txId: transactionId
        // };

        // // Submit the endorsed transaction to the primary orderers.
        // const response: Client.BroadcastResponse = await network.getChannel().sendTransaction(transactionRequest);

        // if (response.status !== 'SUCCESS') {
        //     const msg: string = `Failed to send peer responses for transaction ${transactionId.getTransactionID()} to orderer. Response status: ${response.status}`;
        //     eventHandler.cancelListening();
        //     throw new Error(msg);
        // }

        // await eventHandler.waitForEvents();
        // // return the payload from the invoked chaincode
        // let result: any = null;
        // if (responses && responses.validResponses[0].response.payload.length > 0) {
        //     result = responses.validResponses[0].response.payload;
        // }

        // eventHandler.cancelListening();

        // return result;
    }

    public async getOrderers(): Promise<Set<string>> {

        const ordererSet: Set<string> = new Set();
        const allPeerNames: Array<string> = this.getAllPeerNames();

        for (const peer of allPeerNames) {
            const channels: string[] = await this.getAllChannelsForPeer(peer);
            for (const _channelName of channels) {

                const channel: Client.Channel = await this.getChannel(_channelName);
                const orderers: Client.Orderer[] = channel.getOrderers();

                for (const orderer of orderers) {
                    ordererSet.add(orderer.getName());
                }
            }
        }

        return ordererSet;
    }

    public async register(caName: string, enrollmentID: string, affiliation: string): Promise<string> {
        const request: ClientCA.IRegisterRequest = {
            enrollmentID: enrollmentID,
            affiliation: affiliation,
            role: 'client'
        };

        const fabricCA: FabricCA = this.cas.get(caName);
        const registrar: Client.User = await this.wallet['setUserContext'](this.client, fabricCA.identityName);
        const secret: string = await fabricCA.ca.register(request, registrar);
        return secret;
    }

    protected getAllPeers(): Array<Client.Peer> {
        const peers: Array<Client.Peer> = [];
        this.peers.forEach((fabricPeer: FabricPeer) => {
            peers.push(fabricPeer.peer);
        });

        return peers;
    }

    /**
     * Get a chaincode from a list of list of chaincode
     * @param name {String} The name of the chaincode to find
     * @param chaincodeArray {Array<any>} An array of chaincode to search
     * @returns {any} Returns a chaincode from the given array where the name matches the users input
     */
    private getChaincode(name: string, chaincodeArray: Array<any>): any {
        return chaincodeArray.find((chaincode: any) => {
            return chaincode.name === name;
        });
    }
}
