// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { UmbracoFS } from './umbracoFs';
import { UmbracoApi } from './umbracoApi';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "umbracodocumenttypeeditor" is now active!');
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
