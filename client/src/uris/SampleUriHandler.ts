import { Uri, commands } from 'vscode';
import * as querystring from 'querystring';
import { ExtensionCommands } from '../../ExtensionCommands';

export async function sampleUriHandler(uri: Uri): Promise<void> {
    const query: querystring.ParsedUrlQuery = querystring.parse(uri.query);

    const sampleId: string = query.sampleId as string;
    const repo: string = query.repo as string;

    await commands.executeCommand(ExtensionCommands.OPEN_SAMPLE_PAGE, repo, sampleId);
}
