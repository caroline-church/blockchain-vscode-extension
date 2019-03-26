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
// tslint:disable no-unused-expression

import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
import * as path from 'path';
import { SamplesGalleryView } from '../../src/webview/SamplesGalleryView';
import * as ejs from 'ejs';
import { SampleView } from '../../src/webview/SampleView';
import { RepositoryRegistry } from '../../src/repositories/RepositoryRegistry';
import { ExtensionCommands } from '../../ExtensionCommands';

const should: Chai.Should = chai.should();
chai.use(sinonChai);

describe.only('SamplesGalleryView', () => {
    let mySandBox: sinon.SinonSandbox;

    let executeSpy: sinon.SinonSpy;

    let getSampleGalleryPageStub: sinon.SinonStub;
    let createWebviewPanelStub: sinon.SinonStub;
    let getRepositoriesStub: sinon.SinonStub;

    let context: vscode.ExtensionContext;
    beforeEach(async () => {
        mySandBox = sinon.createSandbox();
        context = {
            extensionPath: '/some/path'
        } as vscode.ExtensionContext;
        executeSpy = mySandBox.spy(vscode.commands, 'executeCommand');

        getSampleGalleryPageStub = mySandBox.stub(SamplesGalleryView, 'getSamplesGalleryPage');
        getSampleGalleryPageStub.resolves('<html>SamplesPage</html>');
        createWebviewPanelStub = mySandBox.stub(vscode.window, 'createWebviewPanel');
        createWebviewPanelStub.returns({
            webview: {
                onDidReceiveMessage: mySandBox.stub(),
                html: ''
            },
            title: 'Samples Gallery',
            onDidDispose: mySandBox.stub(),
            reveal: (): void => { return; }
        });

        const repositories: any = [{ name: 'repo1', samples: [{ name: 'sample1' }] }];
        getRepositoriesStub = mySandBox.stub(SampleView, 'getRepositories').resolves(repositories);
        mySandBox.stub(SampleView, 'getRepository').resolves(repositories[0]);
        mySandBox.stub(SampleView, 'getSample').returns(repositories[0].samples[0]);
    });

    afterEach(() => {
        mySandBox.restore();
    });

    it('should register and show gallery page', async () => {

        mySandBox.stub(Array.prototype, 'find').returns(undefined);

        await SamplesGalleryView.openSampleGalleryPage(context);
        getSampleGalleryPageStub.should.have.been.calledOnce;
    });

    it('should reveal gallery page if already open', async () => {

        const findStub: sinon.SinonStub = mySandBox.stub(Array.prototype, 'find');
        findStub.callThrough();
        findStub.onCall(0).returns(undefined);

        createWebviewPanelStub.returns({
            webview: {
                onDidReceiveMessage: mySandBox.stub(),
                html: ''
            },
            title: 'Samples Gallery',
            onDidDispose: mySandBox.stub(),
            reveal: (): void => { return; }
        });

        await SamplesGalleryView.openSampleGalleryPage(context);
        await SamplesGalleryView.openSampleGalleryPage(context);

        getSampleGalleryPageStub.should.have.been.calledOnce;

        should.equal(createWebviewPanelStub.getCall(1), null);
    });

    it('should dispose gallery page', async () => {
        mySandBox.stub(Array.prototype, 'find').returns(undefined);
        const filterSpy: sinon.SinonSpy = mySandBox.spy(Array.prototype, 'filter');

        createWebviewPanelStub.returns({
            webview: {
                onDidReceiveMessage: mySandBox.stub(),
                html: ''
            },
            onDidDispose: mySandBox.stub().yields()
        });

        await SamplesGalleryView.openSampleGalleryPage(context);

        createWebviewPanelStub.should.have.been.calledWith(
            'samplesGallery',
            'Samples Gallery',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                enableCommandUris: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(context.extensionPath, 'resources'))
                ]

            }
        );

        getSampleGalleryPageStub.should.have.been.calledOnce;

        filterSpy.getCall(1).thisValue[filterSpy.getCall(1).thisValue.length - 1].webview.html.should.equal('<html>SamplesPage</html>');
    });

    it('should do nothing if command is not recognised from gallery page', async () => {
        mySandBox.stub(Array.prototype, 'find').returns(undefined);

        const onDidReceiveMessagePromises: any[] = [];
        onDidReceiveMessagePromises.push(new Promise((resolve: any): void => {
            createWebviewPanelStub.returns({
                webview: {
                    onDidReceiveMessage: async (callback: any): Promise<void> => {
                        await callback({ command: 'unknown-command' });
                        resolve();
                    }
                },
                reveal: (): void => { return; },
                onDidDispose: mySandBox.stub()
            });
        }));
        await SamplesGalleryView.openSampleGalleryPage(context);
        await Promise.all(onDidReceiveMessagePromises);

        createWebviewPanelStub.should.have.been.calledWith(
            'samplesGallery',
            'Samples Gallery',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                enableCommandUris: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(context.extensionPath, 'resources'))
                ]

            }
        );

        getSampleGalleryPageStub.should.have.been.calledOnce;

        should.equal(executeSpy.getCall(2), null); // Command 'unknown-command' shouldn't have been executed

    });

    it('should try to open sample from gallery page', async () => {
        executeSpy.restore();
        const executeCommand: sinon.SinonStub = mySandBox.stub(vscode.commands, 'executeCommand');
        executeCommand.resolves();
        createWebviewPanelStub.onCall(0).returns({
            webview: {
                onDidReceiveMessage: mySandBox.stub().yields({ command: 'openSample', repoName: 'repo1', sampleName: 'sample1' }),
                html: ''
            },
            onDidDispose: mySandBox.stub()
        });

        mySandBox.stub(RepositoryRegistry.prototype, 'get').returns({ name: 'repo1', path: 'path' });
        mySandBox.stub(SampleView, 'getSamplePage').resolves('<html>Sample Page</html>');

        await SamplesGalleryView.openSampleGalleryPage(context);

        createWebviewPanelStub.getCall(0).should.have.been.calledWith(
            'samplesGallery',
            'Samples Gallery',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                enableCommandUris: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(context.extensionPath, 'resources'))
                ]

            }
        );
        getSampleGalleryPageStub.should.have.been.calledOnce;

        executeCommand.getCall(0).should.have.been.calledWith(ExtensionCommands.OPEN_SAMPLE_PAGE, 'repo1', 'sample1');

    });

    it('getGalleryPage', async () => {
        getSampleGalleryPageStub.restore();

        const repository: any = [
            {
                name: 'hyperledger/fabric-samples',
                remote: 'https://github.com/hyperledger/fabric-samples.git',
                samples: [
                    {
                        name: 'FabCar',
                        description: 'Sample project demonstrating the transfer of vehicle ownership'
                    }
                ]
            }
        ];

        getRepositoriesStub.returns(repository);

        mySandBox.stub(ejs, 'renderFile').callThrough();

        const galleryPageHtml: string = await SamplesGalleryView.getSamplesGalleryPage();
        galleryPageHtml.should.contain(`<div class="sample-header">`);
        galleryPageHtml.should.contain(`<h4 class="repository-name">hyperledger/fabric-samples</h4>`);
        galleryPageHtml.should.contain(`<p class="sample-description">Sample project demonstrating the transfer of vehicle ownership</p>`);
    });

    it('should throw error if not able to render file', async () => {
        getSampleGalleryPageStub.restore();

        const repository: any = [
            {
                name: 'hyperledger/fabric-samples',
                remote: 'https://github.com/hyperledger/fabric-samples.git',
                samples: [
                    {
                        name: 'FabCar',
                        description: 'Sample project demonstrating the transfer of vehicle ownership'
                    }
                ]
            }
        ];

        getRepositoriesStub.returns(repository);

        const error: Error = new Error('error happened');
        mySandBox.stub(ejs, 'renderFile').yields(error);

        await SamplesGalleryView.getSamplesGalleryPage().should.be.rejectedWith(error);

    });
});
