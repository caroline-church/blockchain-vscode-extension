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

import { IFabricClientConnection } from './IFabricClientConnection';
import { FabricConnection } from './FabricConnection';
import { FabricWallet } from './FabricWallet';
import { ExtensionUtil } from '../util/ExtensionUtil';

import { Gateway, Network, Contract, GatewayOptions, FileSystemWallet, IdentityInfo } from 'fabric-network';
import * as Client from 'fabric-client';
import * as ClientCA from 'fabric-ca-client';
import { URL } from 'url';

export class FabricClientConnection extends FabricConnection implements IFabricClientConnection {

    private connectionProfilePath: string;
    private gateway: Gateway = new Gateway();
    private networkIdProperty: boolean;

    private identityName: string;

    constructor(connectionProfilePath: string) {
        super();
        this.connectionProfilePath = connectionProfilePath;
    }

    async connect(wallet: FabricWallet, identityName: string): Promise<void> {
        console.log('FabricClientConnection: connect');
        const connectionProfile: object = await ExtensionUtil.readConnectionProfile(this.connectionProfilePath);
        await this.connectInner(connectionProfile, wallet, identityName);
    }

    public disconnect(): void {
        this.gateway.disconnect();
    }

    public isIBPConnection(): boolean {
        return this.networkIdProperty;
    }

    public async getMetadata(instantiatedChaincodeName: string, channel: string): Promise<any> {
        const network: Network = await this.gateway.getNetwork(channel);
        const smartContract: Contract = network.getContract(instantiatedChaincodeName);

        const metadataBuffer: Buffer = await smartContract.evaluateTransaction('org.hyperledger.fabric:GetMetadata');
        const metadataString: string = metadataBuffer.toString();
        let metadataObject: any = {
            contracts: {
                '': {
                    name: '',
                    transactions: [],
                }
            }
        };

        if (metadataString !== '') {
            metadataObject = JSON.parse(metadataBuffer.toString());
        }

        console.log('Metadata object is:', metadataObject);
        return metadataObject;
    }

    public async getAllChannelsForPeer(peerName: string): Promise<Array<string>> {
        return super.getAllChannelsForPeerInner(peerName);
    }

    public async submitTransaction(chaincodeName: string, transactionName: string, channel: string, args: Array<string>, namespace: string, evaluate?: boolean): Promise<string | undefined> {
        const network: Network = await this.gateway.getNetwork(channel);
        const smartContract: Contract = network.getContract(chaincodeName, namespace);

        let response: Buffer;
        if (evaluate) {
            response = await smartContract.evaluateTransaction(transactionName, ...args);
        } else {
            response = await smartContract.submitTransaction(transactionName, ...args);
        }

        if (response.buffer.byteLength === 0) {
            // If the transaction returns no data
            return undefined;
        } else {
            // Turn the response into a string
            const result: any = response.toString('utf8');
            return result;
        }
    }

    public getIdentityName(): string {
        return this.identityName;
    }

    public async enroll(enrollmentID: string, enrollmentSecret: string): Promise<{ certificate: string, privateKey: string }> {
        const enrollment: ClientCA.IEnrollResponse = await this.client.getCertificateAuthority().enroll({ enrollmentID, enrollmentSecret });
        return { certificate: enrollment.certificate, privateKey: enrollment.key.toBytes() };
    }

    protected getAllPeers(): Array<Client.Peer> {
        console.log('getAllPeers');

        return this.client.getPeersForOrg(this.mspid);
    }

    private async connectInner(connectionProfile: object, wallet: FileSystemWallet, identityName: string): Promise<void> {

        this.networkIdProperty = (connectionProfile['x-networkId'] ? true : false);

        this.discoveryAsLocalhost = this.hasLocalhostURLs(connectionProfile);
        this.discoveryEnabled = !this.discoveryAsLocalhost;

        const options: GatewayOptions = {
            wallet: wallet,
            identity: identityName,
            discovery: {
                asLocalhost: this.discoveryAsLocalhost,
                enabled: this.discoveryEnabled
            }
        };

        await this.gateway.connect(connectionProfile, options);

        const identities: IdentityInfo[] = await wallet.list();
        const identity: IdentityInfo = identities.find((identityToSearch: IdentityInfo) => {
            return identityToSearch.label === identityName;
        });

        this.mspid = identity.mspId;
        this.identityName = identityName;
        this.client = this.gateway.getClient();
    }

    private isLocalhostURL(url: string): boolean {
        const parsedURL: URL = new URL(url);
        const localhosts: string[] = [
            'localhost',
            '127.0.0.1'
        ];
        return localhosts.indexOf(parsedURL.hostname) !== -1;
    }

    private hasLocalhostURLs(connectionProfile: any): boolean {
        const urls: string[] = [];
        for (const nodeType of ['orderers', 'peers', 'certificateAuthorities']) {
            if (!connectionProfile[nodeType]) {
                continue;
            }
            const nodes: any = connectionProfile[nodeType];
            for (const nodeName in nodes) {
                if (!nodes[nodeName].url) {
                    continue;
                }
                urls.push(nodes[nodeName].url);
            }
        }
        return urls.some((url: string) => this.isLocalhostURL(url));
    }
}
