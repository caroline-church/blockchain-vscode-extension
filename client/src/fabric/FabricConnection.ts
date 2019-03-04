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

import * as Client from 'fabric-client';
import { IFabricConnection } from './IFabricConnection';
import { FabricWallet } from './FabricWallet';

export abstract class FabricConnection implements IFabricConnection {

    protected client: Client;

    protected mspid: string;
    protected discoveryAsLocalhost: boolean;
    protected discoveryEnabled: boolean;

    public abstract async connect(wallet: FabricWallet, identityName: string): Promise<void>;

    public getAllPeerNames(): Array<string> {
        console.log('getAllPeerNames');
        const allPeers: Array<Client.Peer> = this.getAllPeers();

        const peerNames: Array<string> = [];

        allPeers.forEach((peer: Client.Peer) => {
            peerNames.push(peer.getName());
        });

        return peerNames;
    }

    public getPeer(name: string): Client.Peer {
        console.log('getPeer', name);
        const allPeers: Array<Client.Peer> = this.getAllPeers();

        return allPeers.find((peer: Client.Peer) => {
            return peer.getName() === name;
        });
    }

    public async abstract getAllChannelsForPeer(peerName: string): Promise<Array<string>>;

    public async getAllChannelsForPeerInner(peerName: string): Promise<Array<string>> {
        console.log('getAllChannelsForPeer', peerName);
        const peer: Client.Peer = this.getPeer(peerName);
        const channelResponse: Client.ChannelQueryResponse = await this.client.queryChannels(peer);

        const channelNames: Array<string> = [];
        console.log(channelResponse);
        channelResponse.channels.forEach((channel: Client.ChannelInfo) => {
            channelNames.push(channel.channel_id);
        });

        return channelNames.sort();
    }

    public async getInstantiatedChaincode(channelName: string): Promise<Array<{ name: string, version: string }>> {
        console.log('getInstantiatedChaincode');
        const instantiatedChaincodes: Array<any> = [];
        const channel: Client.Channel = await this.getChannel(channelName);
        const chainCodeResponse: Client.ChaincodeQueryResponse = await channel.queryInstantiatedChaincodes(null);
        chainCodeResponse.chaincodes.forEach((chainCode: Client.ChaincodeInfo) => {
            instantiatedChaincodes.push({ name: chainCode.name, version: chainCode.version });
        });

        return instantiatedChaincodes;
    }

    public async abstract enroll(enrollmentID: string, enrollmentSecret: string, mspid?: string): Promise<{ certificate: string, privateKey: string }>;

    protected async getChannel(channelName: string): Promise<Client.Channel> {
        console.log('getChannel', channelName);
        let channel: Client.Channel = this.client.getChannel(channelName, false);
        if (channel) {
            return channel;
        }
        channel = this.client.newChannel(channelName);
        const peers: Client.Peer[] = this.getAllPeers();
        let lastError: Error = new Error(`Could not discover information for channel ${channelName} from known peers`);
        for (const target of peers) {
            try {
                await channel.initialize({ asLocalhost: this.discoveryAsLocalhost, discover: this.discoveryEnabled, target });
                return channel;
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError;
    }

    protected abstract getAllPeers(): Array<Client.Peer>;
}
