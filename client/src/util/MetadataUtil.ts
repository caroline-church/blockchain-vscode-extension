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
import { VSCodeBlockchainOutputAdapter } from '../logging/VSCodeBlockchainOutputAdapter';
import { LogType } from '../logging/OutputAdapter';
import { IFabricClientConnection } from '../fabric/IFabricClientConnection';

// Functions for parsing metadata object
export class MetadataUtil {

    public static async getTransactionNames(connection: IFabricClientConnection, instantiatedChaincodeName: string, channelName: string): Promise<Map<string, string[]> | null> {
        const metadataTransactions: Map<string, any[]> = await this.getTransactions(connection, instantiatedChaincodeName, channelName);
        if (!metadataTransactions) {
            return null;
        }

        const transactionNames: Map<string, string[]> = new Map();
        for (const [name, transactionObj] of metadataTransactions) {
            const transactions: string[] = [];
            for (const transaction of transactionObj) {
                transactions.push(transaction.name);
            }
            transactionNames.set(name, transactions);
        }
        return transactionNames;
    }

    public static async getContractNames(connection: IFabricClientConnection, instantiatedChaincodeName: string, channelName: string): Promise<string[] | null> {
        const metadataTransactions: Map<string, any[]> = await this.getTransactions(connection, instantiatedChaincodeName, channelName);
        if (!metadataTransactions) {
            return null;
        }

        const contractNames: string[] = [];
        for (const name of metadataTransactions.keys()) {
            contractNames.push(name);
        }

        return contractNames;

    }

    public static async getTransactions(connection: IFabricClientConnection, instantiatedChaincodeName: string, channelName: string, checkForEmpty?: boolean): Promise<Map<string, any[]> | null> {
        const outputAdapter: VSCodeBlockchainOutputAdapter = VSCodeBlockchainOutputAdapter.instance();

        let metadataObj: any = {
            contracts: {
                '' : {
                    name: '',
                    transactions: [],
                }
            }
        };
        const contractsMap: Map<string, any[]> = new Map();

        try {
            metadataObj = await connection.getMetadata(instantiatedChaincodeName, channelName);
            const contractsObject: any = metadataObj.contracts;
            Object.keys(contractsObject).forEach((key: string) => {
                if (key !== 'org.hyperledger.fabric' && (contractsObject[key].transactions.length > 0)) {
                    contractsMap.set(key, contractsObject[key].transactions);
                }
            });

            if (checkForEmpty && (contractsMap.size === 0)) {
                outputAdapter.log(LogType.ERROR, `No metadata returned. Please ensure this smart contract is developed using the programming model delivered in Hyperledger Fabric v1.4+ for JavaScript and TypeScript`);
                return;
            }
        } catch (error) {
            outputAdapter.log(LogType.WARNING, null, `Could not get metadata for smart contract ${instantiatedChaincodeName}. The smart contract may not have been developed with the programming model delivered in Hyperledger Fabric v1.4+ for JavaScript and TypeScript. Error: ${error.message}`);
            return null;
        }

        return contractsMap;
    }

}
