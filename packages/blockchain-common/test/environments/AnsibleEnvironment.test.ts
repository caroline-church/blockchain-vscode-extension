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

import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import * as path from 'path';
import * as fs from 'fs-extra';
import { AnsibleEnvironment } from '../../src/environments/AnsibleEnvironment';
import { FabricWalletGeneratorFactory } from '../../src/util/FabricWalletGeneratorFactory';
import { FabricIdentity } from '../../src/fabricModel/FabricIdentity';
import { FabricWalletRegistryEntry } from '../../src/registries/FabricWalletRegistryEntry';
import { FabricGateway } from '../../src/fabricModel/FabricGateway';
import { FileConfigurations } from '../../src/registries/FileConfigurations';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('AnsibleEnvironment', () => {

    const environmentPath: string = path.resolve('test', 'data', 'nonManagedAnsible');

    let environment: AnsibleEnvironment;
    let sandbox: sinon.SinonSandbox;

    beforeEach(async () => {
        sandbox = sinon.createSandbox();
        environment = new AnsibleEnvironment('nonManagedAnsible', environmentPath);
    });

    afterEach(async () => {
        sandbox.restore();
    });

    describe('#getWalletsAndIdentities', () => {

        it('should create all wallets and import all identities and return registry entries', async () => {
            const importIdentityStub: sinon.SinonStub = sinon.stub().resolves();
            const mockFabricWallet: any = {
                importIdentity: importIdentityStub
            };

            const mockFabricWalletGenerator: any = {
                getWallet: sinon.stub().resolves(mockFabricWallet)
            };

            FabricWalletGeneratorFactory.setFabricWalletGenerator(mockFabricWalletGenerator);

            const entries: FabricWalletRegistryEntry[] = await environment.getWalletsAndIdentities();

            entries.length.should.equal(1);
            entries[0].name.should.equal('myWallet');
            entries[0].walletPath.should.equal(path.join(environmentPath, FileConfigurations.FABRIC_WALLETS, 'myWallet'));
            entries[0].fromEnvironment.should.equal('nonManagedAnsible');
            mockFabricWalletGenerator.getWallet.should.have.been.calledOnceWithExactly(sinon.match.instanceOf(FabricWalletRegistryEntry));
            mockFabricWallet.importIdentity.should.have.been.calledOnceWithExactly(sinon.match.string, sinon.match.string, 'admin', 'Org1MSP');
        });
    });

    describe('#getFabricGateways', () => {

        it('should return an empty array if no gateways directory', async () => {
            sandbox.stub(fs, 'pathExists').resolves(false);
            await environment.getFabricGateways().should.eventually.deep.equal([]);
        });

        it('should return all of the gateways', async () => {
            const gateways: FabricGateway[] = await environment.getFabricGateways();
            const sortedGateways: FabricGateway[] = gateways.sort((a: FabricGateway, b: FabricGateway) => {
                return a.name.localeCompare(b.name);
            });
            sortedGateways.should.have.lengthOf(3);
            sortedGateways.should.deep.equal([
                {
                    name: 'myGateway',
                    path: path.resolve(environmentPath, 'gateways', 'yofn.json'),
                    connectionProfile: {
                        name: 'myGateway',
                        version: '1.0.0',
                        client: {
                            organization: 'Org1',
                            connection: {
                                timeout: {
                                    peer: {
                                        endorser: '300'
                                    },
                                    orderer: '300'
                                }
                            }
                        },
                        organizations: {
                            Org1: {
                                mspid: 'Org1MSP',
                                peers: [
                                    'peer0.org1.example.com'
                                ],
                                certificateAuthorities: [
                                    'ca.org1.example.com'
                                ]
                            }
                        },
                        peers: {
                            'peer0.org1.example.com': {
                                url: 'grpc://localhost:17051'
                            }
                        },
                        certificateAuthorities: {
                            'ca.org1.example.com': {
                                url: 'http://localhost:17054',
                                caName: 'ca.org1.example.com'
                            }
                        }
                    }
                },
                {
                    name: 'yofn-org1',
                    path: path.resolve(environmentPath, 'gateways', 'org1', 'yofn.json'),
                    connectionProfile: {
                        name: 'yofn-org1',
                        version: '1.0.0',
                        wallet: 'org1-wallet',
                        client: {
                            organization: 'Org1',
                            connection: {
                                timeout: {
                                    peer: {
                                        endorser: '300'
                                    },
                                    orderer: '300'
                                }
                            }
                        },
                        organizations: {
                            Org1: {
                                mspid: 'Org1MSP',
                                peers: [
                                    'peer0.org1.example.com'
                                ],
                                certificateAuthorities: [
                                    'ca.org1.example.com'
                                ]
                            }
                        },
                        peers: {
                            'peer0.org1.example.com': {
                                url: 'grpc://localhost:17051'
                            }
                        },
                        certificateAuthorities: {
                            'ca.org1.example.com': {
                                url: 'http://localhost:17054',
                                caName: 'ca.org1.example.com'
                            }
                        }
                    }
                },
                {
                    name: 'yofn-org2',
                    path: path.resolve(environmentPath, 'gateways', 'org2', 'yofn.json'),
                    connectionProfile: {
                        name: 'yofn-org2',
                        version: '1.0.0',
                        wallet: 'org2-wallet',
                        client: {
                            organization: 'Org2',
                            connection: {
                                timeout: {
                                    peer: {
                                        endorser: '300'
                                    },
                                    orderer: '300'
                                }
                            }
                        },
                        organizations: {
                            Org2: {
                                mspid: 'Org2MSP',
                                peers: [
                                    'peer0.org2.example.com'
                                ],
                                certificateAuthorities: [
                                    'ca.org2.example.com'
                                ]
                            }
                        },
                        peers: {
                            'peer0.org2.example.com': {
                                url: 'grpc://localhost:17051'
                            }
                        },
                        certificateAuthorities: {
                            'ca.org2.example.com': {
                                url: 'http://localhost:17054',
                                caName: 'ca.org2.example.com'
                            }
                        }
                    }
                }
            ]);
        });
    });

    describe('#getWalletNames', () => {

        it('should return an empty array if no wallets directory', async () => {
            sandbox.stub(fs, 'pathExists').resolves(false);
            await environment.getWalletNames().should.eventually.deep.equal([]);
        });

        it('should return all of the wallet names', async () => {
            await environment.getWalletNames().should.eventually.deep.equal(['myWallet']);
        });

    });

    describe('#getIdentities', () => {

        it('should return an empty array if no wallet directory', async () => {
            sandbox.stub(fs, 'pathExists').resolves(false);
            await environment.getIdentities('myWallet').should.eventually.deep.equal([]);
        });

        it('should return all of the identities', async () => {
            await environment.getIdentities('myWallet').should.eventually.deep.equal([
                new FabricIdentity(
                    'admin',
                    'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUNXRENDQWYrZ0F3SUJBZ0lVUU4zUlE1MFB6R0wrZFRBc2haeXJRNGc2MEFZd0NnWUlLb1pJemowRUF3SXcKY3pFTE1Ba0dBMVVFQmhNQ1ZWTXhFekFSQmdOVkJBZ1RDa05oYkdsbWIzSnVhV0V4RmpBVUJnTlZCQWNURFZOaApiaUJHY21GdVkybHpZMjh4R1RBWEJnTlZCQW9URUc5eVp6RXVaWGhoYlhCc1pTNWpiMjB4SERBYUJnTlZCQU1UCkUyTmhMbTl5WnpFdVpYaGhiWEJzWlM1amIyMHdIaGNOTVRrd05ERTRNVFl4TkRBd1doY05NakF3TkRFM01UWXgKT1RBd1dqQmRNUXN3Q1FZRFZRUUdFd0pWVXpFWE1CVUdBMVVFQ0JNT1RtOXlkR2dnUTJGeWIyeHBibUV4RkRBUwpCZ05WQkFvVEMwaDVjR1Z5YkdWa1oyVnlNUTh3RFFZRFZRUUxFd1pqYkdsbGJuUXhEakFNQmdOVkJBTVRCV0ZrCmJXbHVNRmt3RXdZSEtvWkl6ajBDQVFZSUtvWkl6ajBEQVFjRFFnQUVDSTNkbnI1ekx0b3VmbmF4N0l2bnRMQ3EKY0gyMlZveXhYck43RHNZTG1MOExIWHFkTE9STGRCMHlBeVQ5a3FqRVJlYVFGUys5eWY0RGhFUVh5YTRsaEtPQgpoakNCZ3pBT0JnTlZIUThCQWY4RUJBTUNCNEF3REFZRFZSMFRBUUgvQkFJd0FEQWRCZ05WSFE0RUZnUVUvR2x6CjB0TWowYkRxblZ2YXBRcG1MY0Fscmdnd0t3WURWUjBqQkNRd0lvQWdNRklUMFpYR1dhMzU1THlUNEJ6c2RHNGoKdy9RNHBkeTByTzUrdEtGVEY1SXdGd1lEVlIwUkJCQXdEb0lNWkRnek5UVTFaRGsxT1dNNU1Bb0dDQ3FHU000OQpCQU1DQTBjQU1FUUNJQ2VrdEcrejAxUkZHOTc2bStNWnJyckFZN0srckxVYXFPYmk1YStsSWs0ckFpQTBsMzN2CjU4dkFvMFhYbU9ncnQrUmQwWFZJbDZJUW1EVFFrZnNwT3RsVDV3PT0KLS0tLS1FTkQgQ0VSVElGSUNBVEUtLS0tLQo=',
                    'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JR0hBZ0VBTUJNR0J5cUdTTTQ5QWdFR0NDcUdTTTQ5QXdFSEJHMHdhd0lCQVFRZ3RGK29wMGFWMWx1TTU0VGoKTVV1Rnhod3pSUmM3S1VMMDhjT0IyZFRjTG1HaFJBTkNBQVFJamQyZXZuTXUyaTUrZHJIc2krZTBzS3B3ZmJaVwpqTEZlczNzT3hndVl2d3NkZXAwczVFdDBIVElESlAyU3FNUkY1cEFWTDczSi9nT0VSQmZKcmlXRQotLS0tLUVORCBQUklWQVRFIEtFWS0tLS0tCg==',
                    'Org1MSP'
                )
            ]);
        });
    });
});
