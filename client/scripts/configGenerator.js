// import * as ejs from 'ejs';
const ejs = require('ejs');
const path = require('path');
const fs = require('fs-extra');

async function main() {

    const templateData = {
        orgs: [
            { name: 'Org1', domain: 'org1.example.com', mspid: 'Org1MSP' },
            { name: 'Org2', domain: 'org2.example.com', mspid: 'Org2MSP' }
        ],
        channels: [
            { name: 'mychannel', orgs: ['Org1', 'Org2'] },
            { name: 'otherchannel', orgs: ['Org1', 'Org2'] }
        ]

    };

    const filesToCreate = [
        { name: 'crypto-config', extension: 'yaml' }, 
        { name: 'configtx', extension: 'yaml' }, 
        { name: 'docker-compose', extension: 'yaml' },
        { name: 'generateConfig', extension: 'sh'},
        { name: 'start', extension: 'sh'}
    ];

    for (file of filesToCreate) {
        const dataToWrite = await createDataToWrite(file.name + '.ejs', templateData);
        await writeData(`${file.name}.${file.extension}`, dataToWrite);
    }
}

async function writeData(fileName, dataToWrite) {
    try {
        const fileToWrite = path.join(__dirname, '..', 'scripts', 'stuff', fileName);

        console.log('writing file:', fileToWrite);

        await fs.ensureFile(fileToWrite);
        await fs.writeFile(fileToWrite, dataToWrite);
        await fs.chmod(fileToWrite, '0777');
    } catch (error) {
        console.log(error);
    }
}

async function createDataToWrite(template, templateData) {
    template = path.join(__dirname, '..', 'templates', 'fabric', template);
    console.log('createDataToWrite using template file:', template);

    const ejsOptions = {
        async: true,
    };
    return new Promise((resolve, reject) => {
        // TODO: promisify this?
        ejs.renderFile(template, templateData, ejsOptions, (error, data) => {
            if (error) {
                reject(error);
            } else {
                resolve(data);
            }
        });
    });
}

main();
