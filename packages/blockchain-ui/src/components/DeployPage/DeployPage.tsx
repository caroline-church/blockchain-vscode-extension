import React, { Component } from 'react';
import './DeployPage.scss';
import DeployForm from '../DeployForm/DeployForm';
import DeploySummery from '../DeploySummary/DeploySummry';
import IDeployInfo from '../../interfaces/IDeployInfo';

enum DeployState {
    SETDEFINITION = 0,
    DEPLOYING = 1,
    DONE = 2
}

interface PageProps {
    environmentName: string;
    smartContractPackages: string[];
    postMessageHandler: (command: string, data?: any) => void;
}

interface PageState {
    environmentName: string;
    smartContractPackages: string[];
    deployState: DeployState;
    deployInfo: IDeployInfo | undefined;
    postMessageHandler: (command: string, data?: any) => void;
}

class DeployPage extends Component<PageProps, PageState> {
    constructor(props: Readonly<PageProps>) {
        super(props);
        this.state = {
            environmentName: this.props.environmentName,
            smartContractPackages: this.props.smartContractPackages,
            deployState: DeployState.SETDEFINITION,
            deployInfo: undefined,
            postMessageHandler: this.props.postMessageHandler
        };

        this.handleDeployButtonClick = this.handleDeployButtonClick.bind(this);
    }

    componentDidUpdate(prevProps: PageProps): void {
        // if (prevProps.transactionOutput !== this.props.transactionOutput) {
        //     this.setState({
        //         transactionOutput: this.props.transactionOutput
        //     });
        // }
    }

    handleDeployButtonClick(deployInfo: IDeployInfo): void {
        this.setState({ deployInfo: deployInfo, deployState: DeployState.DEPLOYING });
        // this.state.postMessageHandler(ExtensionCommands.INSTANTIATE_SMART_CONTRACT, this.state.deployInfo);
    }

    render(): JSX.Element {
        const deployForm: JSX.Element = <DeployForm smartContractPackages={this.state.smartContractPackages} onClick={(deployInfo: IDeployInfo): void => this.handleDeployButtonClick(deployInfo)} />;
        const deploySummary: JSX.Element = <DeploySummery deployInfo={this.state.deployInfo as IDeployInfo} />;

        let shownElement: JSX.Element = deployForm;
        if (this.state.deployState === DeployState.DEPLOYING) {
            shownElement = deploySummary;
        }

        return (
            <div className='page-container bx--grid' data-test-id='txn-page'>
                <div className='inner-container bx--row'>
                    <div className='page-contents bx--col'>
                        <div className='titles-container'>
                            <span className='home-link'>Deploy smart contract to environment</span>
                            <h2>Deploying to: Bob</h2>
                        </div>
                        <div className='contents-container bx--row'>
                            <div className='bx--col'>
                                {shownElement}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default DeployPage;
