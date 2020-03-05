import React, { Component } from 'react';
import './DeploySummary.scss';
import IDeployInfo from '../../interfaces/IDeployInfo';

interface CreateFormProps {
    deployInfo: IDeployInfo;
}

interface CreateFormState {
    deployInfo: IDeployInfo | undefined;
}

class DeployForm extends Component<CreateFormProps, CreateFormState> {
    constructor(props: Readonly<CreateFormProps>) {
        super(props);

        this.state = {
            deployInfo: this.props.deployInfo
        };
    }

    render(): JSX.Element {
        const deployInfo: IDeployInfo = this.state.deployInfo as IDeployInfo;
        return (
            <div>
                <div>Deploying</div>
                <div>
                    <div><span>Name: </span><span>{deployInfo.name}</span></div>
                    <div><span>Version: </span><span>{deployInfo.version}</span></div>
                </div>
            </div>
        );
    }
}

export default DeployForm;
