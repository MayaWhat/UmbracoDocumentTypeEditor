import * as vscode from 'vscode';
import { UmbracoApi } from './umbracoApi';
import { generateContentTypeCodeFile } from './contentTypeCodeGenerator';
import { parseContentTypeCode } from './contentTypeCodeParser';
import { createContentType, renameContentType, updateContentType } from './contentTypeUpdater';

export class UmbracoFS implements vscode.FileSystemProvider {
    private _umbracoApis: { [url: string]: UmbracoApi } = {};

    watch(): vscode.Disposable {
        return new vscode.Disposable(() => {});
    }

    async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        const result = await this.interpretUri(uri);
        if (!result) {
            throw vscode.FileSystemError.FileNotFound();
        }

        return {
            type: result.node.folder ? vscode.FileType.Directory : vscode.FileType.File,
            ctime: Date.now(),
            mtime: Date.now(),
            size: 0,
            permissions: result.node.readonly ? vscode.FilePermission.Readonly : undefined
        };        
    }

    async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        console.log(`read directory ${uri}`);
        const result = await this.interpretUri(uri);
        if (!result) {
            return [];
        }

        await this.populateChildren(result.node, result.umbracoApi);
        return result.node.children?.map(x => [
            x.name, x.folder ? vscode.FileType.Directory : vscode.FileType.File
        ]) ?? [];
    }

    async createDirectory(uri: vscode.Uri): Promise<void> {
        const { name, result } = await this.getParentNode(uri);

        if (!name) {
            throw new Error("Folder needs name");
        }

        await result.umbracoApi.createContainer(result.node.umbracoId, name);
    }

    async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        console.log(`read file ${uri}`);
        const result = await this.interpretUri(uri, true);
        if (!result) {
            throw vscode.FileSystemError.FileNotFound();
        }
        
        const allContentTypes = await result.umbracoApi.getAllContentTypes();
        const contentType = await result.umbracoApi.getContentTypeById(result.node.umbracoId);
        const dataTypes = Object.values(await result.umbracoApi.getGroupedDataTypes()).flatMap(x => x);
        const availableCompositions = await result.umbracoApi.getAvailableCompositeContentTypes({
            contentTypeId: contentType.id,
            filterContentTypes: contentType.compositeContentTypes ?? [],
            filterPropertyTypes: contentType.groups.flatMap(x => x.properties).map(x => x.alias),
            isElement: contentType.isElement
        });
        const availableIcons = await result.umbracoApi.getIcons();

        const js = generateContentTypeCodeFile(contentType, allContentTypes) + "\n\n\n" + typeHelper + `
 * @typedef {(
 * ${dataTypes.map(x => `'${x.name}'`).join(' |\n * ')}
 * )} DataTypes
 

 * @typedef {(
 * ${availableCompositions.filter(x => x.allowed).map(x => `'${x.contentType.alias}'`).join(' |\n * ')}
 * )} AvailableCompositions


 * @typedef {(
 * ${allContentTypes.filter(x => x.alias !== contentType.alias && !x.isElement).map(x => `'${x.alias}'`).join(' |\n * ')}
 * )} AvailableChildTypes
 

 * @typedef {(
 * ${Object.keys(availableIcons).map(x => `'${x}'`).join(' |\n * ')}
 * )} AvailableIcons
 */`;
        return Buffer.from(js);
    }

    async writeFile(uri: vscode.Uri, content: Uint8Array): Promise<void> {
        const result = await this.interpretUri(uri, true);

        if (!result) {
            let { name, result: parentResult } = await this.getParentNode(uri);

            if (!name) {
                throw new Error("Content type needs name");
            }

            if (name.endsWith(".js")) {
                name = name.substring(0, name.length - 3);
            }
            else {
                throw new Error("Only .js files are supported");
            }

            await createContentType(parentResult.umbracoApi, name, +parentResult.node.umbracoId);
        }
        else {    
            const code = new TextDecoder().decode(content);
            const parsed = parseContentTypeCode(code);
    
            await updateContentType(result.umbracoApi, result.node.umbracoId, parsed);
        }

        this._emitter.fire([{
            type: vscode.FileChangeType.Created,
            uri
        }]);
    }

    async delete(uri: vscode.Uri): Promise<void>{
        const result = await this.interpretUri(uri);
        if (!result) {
            throw vscode.FileSystemError.FileNotFound();
        }

        if (!result.node || !result.node.umbracoId) {
            throw new Error("Can't delete this node");
        }

        if (result.node.folder) {
            await result.umbracoApi.deleteContainer(result.node.umbracoId);
        } else {
            await result.umbracoApi.deleteContentType(result.node.umbracoId);
        }

        this._emitter.fire([{
            type: vscode.FileChangeType.Deleted,
            uri
        }]);
    }

    async rename(oldUri: vscode.Uri, newUri: vscode.Uri): Promise<void> {
        const result = await this.interpretUri(oldUri);
        if (!result) {
            throw vscode.FileSystemError.FileNotFound();
        }

        let name = newUri.path.split('/').pop() ?? '';
        if (result.node.folder) {
            await result.umbracoApi.renameContainer(result.node.umbracoId, name);
        } else {
            if (name.endsWith(".js")) {
                name = name.substring(0, name.length - 3);
            }
            else {
                throw new Error("Only .js files are supported");
            }

            await renameContentType(result.umbracoApi, result.node.umbracoId, name);
        }

        this._emitter.fire([{
            type: vscode.FileChangeType.Deleted,
            uri: oldUri
        }, {
            type: vscode.FileChangeType.Created,
            uri: newUri
        }]);
    }

    private async interpretUri(uri: vscode.Uri, onlyFiles?: boolean) {
        let path = uri.path;
        while (path.startsWith('/')) {
            path = path.substring(1);
        }
        
        const pathBits = path.split('/');
        const umbracoUrl = `${uri.authority}//${pathBits[0]}`;

        if (!this._nodes[umbracoUrl]) {
            this._nodes[umbracoUrl] = {
                name: umbracoUrl,
                readonly: true,
                folder: true,
                umbracoId: '',
                children: this._baseNodes.map(x => ({
                    ...x,
                    children: x.children?.map(c => ({
                        ...c
                    }))
                }))
            };

            this._umbracoApis[umbracoUrl] = new UmbracoApi(umbracoUrl);
        }

        const umbracoApi = this._umbracoApis[umbracoUrl];

        let node = this._nodes[umbracoUrl];
        for (let i = 1; i < pathBits.length; i++) {
            const bit = pathBits[i];

            await this.populateChildren(node, umbracoApi);
            const child = node.children?.find(x => x.name == bit && (i < pathBits.length - 1 || !onlyFiles || !x.folder));
            if (!child) {
                return null;
            }

            node = child;
        }

        return {
            umbracoApi,
            node
        };
    }

    private async populateChildren(node: Node, umbracoApi: UmbracoApi) {
        if (node.umbracoId) {
            node.children = await this.getNodes(node.umbracoId, umbracoApi);
        }
    }

    private async getNodes(umbracoId: string, umbracoApi: UmbracoApi): Promise<Node[] | undefined> {   
        const nodes = await umbracoApi.getContentTypeNodes(umbracoId);
        const results = nodes.map(x => ({
            folder: x.nodeType == 'container',
            name: (x.name ?? '') + (x.nodeType == 'container' ? '' : '.js'),
            umbracoId: x.id
        }));

        const filesWithChildren = nodes.filter(x => x.nodeType != 'container' && x.hasChildren).map(x => ({
            folder: true,
            name: x.name ?? '',
            umbracoId: x.id
        }));

        results.splice(results.length, 0, ...filesWithChildren);

        return results;
    }

    private async getParentNode(uri: vscode.Uri) {
        const pathBits = uri.path.split('/');
        const name = pathBits.pop();

        const parentUri = uri.with({
            path: pathBits.slice(0, pathBits.length).join('/')
        });

        const result = await this.interpretUri(parentUri);
        if (!result || !result.node.folder || !result.node.umbracoId) {
            throw new Error("Invalid parent folder");
        }

        return {
            name,
            result
        };
    }

    private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

    private _nodes: { [baseUrl: string]: Node } = {};

    private _baseNodes: Node[] = [{
        name: 'Document Types',
        folder: true,
        umbracoId: '-1',
        readonly: true
    }];
}

type Node = {
    name: string;
    folder: boolean;
    children?: Node[];
    readonly?: boolean;
    umbracoId: string;
};

const typeHelper = `
// VSCode's typescript language service doesn't support virtual file systems, so these class definitions are provided in this file for intellisense purposes
class DocumentType {
    /**
     * @param {{
     *  alias: string,
     *  name: string,
     *  allowedTemplates?: string[],
     *  defaultTemplate?: string,
     *  allowAsRoot?: boolean,
     *  allowedChildTypes?: AvailableChildTypes[],
     *  allowCultureVariant?: boolean,
     *  allowSegmentVariant?: boolean,
     *  compositions?: AvailableCompositions[],
     *  description?: string,
     *  enableListView?: boolean,
     *  historyCleanup?: {
     *    preventCleanup?: boolean,
     *    keepAllVersionsNewerThanDays?: number,
     *    keepLatestVersionPerDayForDays?: number,
     *  },
     *  icon?: {
     *    name: AvailableIcons,
     *    color:  \`color-\${AvailableColors}\`
     *  } | AvailableIcons,
     *  isElement?: boolean,
     *  tabs?: Tab[],
     *  groups?: Group[]
     * }} properties 
     */
    constructor(properties) {}
}

class Tab {
    /**
     * @param {{
     *  alias?: string,
     *  name: string,
     *  sortOrder?: number,
     *  groups: Group[]
     * }} properties 
     */
    constructor(properties) {}
}

class Group {
    /**
    * @param {{
    *  alias?: string,
    *  name: string,
    *  sortOrder?: number,
    *  properties: Property[]
    * }} properties 
    */
   constructor(properties) {}
}

class Property {
    /**
     * @param {{
     *  alias?: string,
     *  label: string,
     *  allowCultureVariant?: boolean,
     *  allowSegmentVariant?: boolean,
     *  dataType: DataTypes,
     *  description?: string,
     *  labelOnTop?: boolean,
     *  sortOrder?: number,
     *  validation?: {
     *   mandatory?: boolean,
     *   mandatoryMessage?: string,
     *   pattern?: string,
     *   patternMessage?: string
     * }}} properties 
     */
    constructor(properties) {}
}

/**
 * @typedef {(
 * 'black' |
 * 'blue-grey' |
 * 'grey' |
 * 'brown' |
 * 'blue' |
 * 'light-blue' |
 * 'indigo' |
 * 'purple' |
 * 'deep-purple' |
 * 'cyan' |
 * 'green' |
 * 'light-green' |
 * 'lime' |
 * 'yellow' |
 * 'amber' |
 * 'orange' |
 * 'deep-orange' |
 * 'red' |
 * 'pink'
 * )} AvailableColors

`