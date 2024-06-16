import * as vscode from 'vscode';
import { UmbracoFS } from './umbracoFs';

export function activate(context: vscode.ExtensionContext) {

	// TODO: there's probably a better way to handle this, but it's pretty common for localhost
	// to not have valid certs
	process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

	const umbracoFS = new UmbracoFS();
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider('umbracodocumenttypeeditor', umbracoFS));

	context.subscriptions.push(vscode.commands.registerCommand('umbracodocumenttypeeditor.openUmbracoWorksspace', async () => {
		let umbracoUrl = await vscode.window.showInputBox({
			prompt: 'Enter Umbraco URL',
			ignoreFocusOut: true
		});

		if (!umbracoUrl) {
			return;
		}

		const umbracoUri = vscode.Uri.parse(umbracoUrl);

		const uri = vscode.Uri.from({
			scheme: 'umbracodocumenttypeeditor',
			authority: `${umbracoUri.scheme}://${umbracoUri.authority}`
		});

		vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders?.length ?? 0, 0, {
			uri,
			name: `${umbracoUri.scheme}://${umbracoUri.authority}`
		});

		vscode.commands.executeCommand('workbench.explorer.fileView.focus');
	}));
}

export function deactivate() {}
