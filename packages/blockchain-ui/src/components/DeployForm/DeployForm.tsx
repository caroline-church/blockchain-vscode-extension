import React, { Component } from 'react';
import './DeployForm.scss';
import IDeployInfo from '../../interfaces/IDeployInfo';
import { Button, Form, FormGroup, TextInput, Select, SelectItem } from 'carbon-components-react';

interface CreateFormProps {
    smartContractPackages: string[];
    onClick: (deployInfo: IDeployInfo) => void;
}

interface CreateFormState {
    smartContractPackages: string[];
    selectedPackage: string | undefined;
    deployInfo: IDeployInfo | undefined;
}

class DeployForm extends Component<CreateFormProps, CreateFormState> {
    constructor(props: Readonly<CreateFormProps>) {
        super(props);

        this.state = {
            smartContractPackages: this.props.smartContractPackages,
            selectedPackage: undefined,
            deployInfo: undefined
        };

        this.populateSmartContractSelect = this.populateSmartContractSelect.bind(this);
        this.updateSelectedPackage = this.updateSelectedPackage.bind(this);
        this.updateName = this.updateName.bind(this);
        this.updateVersion = this.updateVersion.bind(this);
    }

    populateSmartContractSelect(): Array<JSX.Element> {
        const options: Array<JSX.Element> = [];
        options.push(<SelectItem disabled={false} hidden={true} text='Select the smart contract package' value='placeholder-item' />);

        for (const _package of this.state.smartContractPackages) {
            options.push(<SelectItem disabled={false} hidden={false} text={_package} value={_package} />);
        }

        return options;
    }

    updateSelectedPackage(event: React.FormEvent<HTMLSelectElement>): void {
        const selectedPackage: string = event.currentTarget.value;
        this.setState({ selectedPackage: selectedPackage });

        const name: string = selectedPackage.split('@')[0];
        const version: string = selectedPackage.split('@')[1];

        this.setState({
            deployInfo: {
                name: name,
                version: version,
                selectedPackage: selectedPackage
            }
        });

        // TODO generate the other parts of the form
    }

    updateName(event: React.FormEvent<HTMLInputElement>): void {
        const deployInfo: IDeployInfo = this.state.deployInfo as IDeployInfo;
        deployInfo.name = event.currentTarget.value;
        this.setState({
            deployInfo: deployInfo
        });
    }

    updateVersion(event: React.FormEvent<HTMLInputElement>): void {
        const deployInfo: IDeployInfo = this.state.deployInfo as IDeployInfo;
        deployInfo.version = event.currentTarget.value;
        this.setState({
            deployInfo: deployInfo
        });
    }

    render(): JSX.Element {

        let deployBox: JSX.Element = <div></div>;
        if (this.state.selectedPackage) {
            const deployInfo: IDeployInfo = this.state.deployInfo as IDeployInfo;
            deployBox = (
                <div>
                    <FormGroup legendText='Name'>
                        <TextInput id='name-input' labelText='Name' onChange={this.updateName} value={deployInfo.name}></TextInput>
                    </FormGroup>
                    <FormGroup legendText='Version'>
                        <TextInput id='version-input' labelText='Version' onChange={this.updateVersion} value={deployInfo.version}></TextInput>
                    </FormGroup>
                    <FormGroup legendText='Deploy'>
                        <Button size='field' className='deploy-button' id='deploy-button' disabled={false} onClick={(): void => this.props.onClick(this.state.deployInfo as IDeployInfo)}>Deploy</Button>
                    </FormGroup>
                </div>
            );
        }

        return (
            <Form id='create-txn-form'>
                <FormGroup legendText='Smart Contract Package'>
                    <Select id='smart-contract-package-select' labelText='Smart Contract Package*' className='select-width' onChange={this.updateSelectedPackage}>
                        {this.populateSmartContractSelect()}
                    </Select>
                </FormGroup>
                {deployBox}
            </Form>
        );
    }
}

export default DeployForm;
