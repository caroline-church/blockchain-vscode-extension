import { Uri, commands } from 'vscode';
import * as querystring from 'querystring';
import { ExtensionCommands } from '../../ExtensionCommands';

export async function connectionUriHandler(uri: Uri): Promise<void> {
    const query: querystring.ParsedUrlQuery = querystring.parse(uri.query);

    const connectionProfileString: string = decodeURI(query.connectionProfile as string).replace(/\\\\/g, '\\');

    await commands.executeCommand(ExtensionCommands.ADD_GATEWAY, connectionProfileString);
}
