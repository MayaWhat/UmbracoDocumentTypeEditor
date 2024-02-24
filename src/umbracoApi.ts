import * as vscode from 'vscode';
import * as umbracoModels from './models/umbraco';

export class UmbracoApi {
    private _umbracoUsername: string | undefined;
    private _umbracoPassword: string | undefined;
    private _umbracoCookie: string | undefined;
    private _umbracoXsrfToken: string | undefined;
    private _currentLoginRequest?: Promise<boolean>

    constructor(private readonly _umbracoUrl: string) {
    }

    private async loginInternal(failed?: boolean): Promise<boolean> {
        if (failed || !this._umbracoUsername || !this._umbracoPassword) {
            const umbracoUsername = await vscode.window.showInputBox({
                prompt: 'Enter Umbraco username',
                ignoreFocusOut: true,
                value: this._umbracoUsername
            });

            if (!umbracoUsername) {
                return false;
            }

            this._umbracoUsername = umbracoUsername;
        }

        if (failed || !this._umbracoPassword) {
            const umbracoPassword = await vscode.window.showInputBox({
                prompt: 'Enter Umbraco password',
                password: true,
                ignoreFocusOut: true
            });

            if (!umbracoPassword) {
                return false;
            }

            this._umbracoPassword = umbracoPassword;
        }

        const response = await fetch(`${this._umbracoUrl}/umbraco/backoffice/umbracoapi/authentication/PostLogin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: this._umbracoUsername,
                password: this._umbracoPassword
            })
        });

        if (!response.ok) {
            this._umbracoPassword = undefined;
            vscode.window.showErrorMessage("Umbraco login failed");
            return await this.loginInternal(true);
        }

        this._umbracoCookie = response.headers.getSetCookie().join('; ');
        const token = response.headers.getSetCookie().find(x => x.startsWith('UMB-XSRF-TOKEN='));
        this._umbracoXsrfToken = token?.substring(15).split('; ')[0];
        return true;
    }

    public async login(): Promise<boolean> {
        if (this._currentLoginRequest) {
            return this._currentLoginRequest;
        }

        this._currentLoginRequest = this.loginInternal();
        const result = await this._currentLoginRequest;
        this._currentLoginRequest = undefined;
        return result;
    }

    public async getSafeAlias(value: string): Promise<umbracoModels.SafeAlias> {
        return JSON.parse(await this.doFetch(`umbraco/backoffice/umbracoapi/entity/GetSafeAlias?value=${encodeURIComponent(value)}&camelCase=true`));
    }

    public async getContentTypeNodes(umbracoId: string): Promise<umbracoModels.TreeNode[]> {   
        return JSON.parse(await this.doFetch(`umbraco/backoffice/umbracotrees/contenttypetree/GetNodes?id=${umbracoId}&application=settings&tree=documentTypes&use=main`));
    }

    public async getContentTypeById(umbracoId: string): Promise<umbracoModels.DocumentTypeDisplay> {
        return JSON.parse(await this.doFetch(`umbraco/backoffice/umbracoapi/contenttype/GetById?id=${umbracoId}`));
    }

    public async getEmptyContentType(parentId: string): Promise<umbracoModels.DocumentTypeDisplay> {
        return JSON.parse(await this.doFetch(`umbraco/backoffice/umbracoapi/contenttype/GetEmpty?parentId=${parentId}`));
    }

    public async getAllContentTypes(): Promise<umbracoModels.ContentTypeBasic[]> {
        return JSON.parse(await this.doFetch(`umbraco/backoffice/umbracoapi/contenttype/GetAll`));
    }

    public async getGroupedDataTypes(): Promise<{ [key: string]: umbracoModels.DataTypeBasic[] }> {
        return JSON.parse(await this.doFetch('umbraco/backoffice/umbracoapi/datatype/GetGroupedDataTypes'));
    }

    public async saveContentType(contentTypeSave: umbracoModels.DocumentTypeSave): Promise<umbracoModels.DocumentTypeDisplay>  {
        return JSON.parse(await this.doFetch('umbraco/backoffice/umbracoapi/contenttype/PostSave', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(contentTypeSave)
        }));
    }

    public deleteContentType(id: string) {
        return this.doFetch(`umbraco/backoffice/umbracoapi/contenttype/DeleteById?id=${id}`, {
            method: 'DELETE'
        });
    }

    public createContainer(parentId: string, name: string) {
        return this.doFetch(`umbraco/backoffice/umbracoapi/contenttype/PostCreateContainer?parentId=${parentId}&name=${encodeURIComponent(name)}`, {
            method: 'POST'
        });
    }

    public renameContainer(id: string, name: string) {
        return this.doFetch(`umbraco/backoffice/umbracoapi/contenttype/PostRenameContainer?id=${id}&name=${encodeURIComponent(name)}`, {
            method: 'POST'
        });
    }

    public deleteContainer(id: string) {
        return this.doFetch(`umbraco/backoffice/umbracoapi/contenttype/DeleteContainer?id=${id}`, {
            method: 'DELETE'
        });
    }

    public async getAvailableCompositeContentTypes(filter: umbracoModels.GetAvailableCompositionsFilter):
        Promise<{contentType: umbracoModels.EntityBasic, allowed: boolean}[]> {
        return JSON.parse( await this.doFetch('umbraco/backoffice/umbracoapi/contenttype/GetAvailableCompositeContentTypes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(filter)
        }));
    }

    private async doFetch<T>(relativeUrl: string, init?: RequestInit): Promise<string> {
        try {
            
            if (!this._umbracoCookie) {
                const loginResult = await this.login();
                if (!loginResult) {
                    throw new Error('Login cancelled');
                }
            }

            if (!init) {
                init = {};
            }

            init.redirect = 'manual';
            init.headers = {
                ...init.headers ?? {},
                'Cookie': this._umbracoCookie ?? '',
                'X-UMB-XSRF-TOKEN': this._umbracoXsrfToken ?? ''
            };

            while (relativeUrl.startsWith('/')) {
                relativeUrl = relativeUrl.substring(1);
            }

            const response = await fetch(`${this._umbracoUrl}/${relativeUrl}`, init);
    
            if (!response.ok) {
                if (response.status == 302 || response.status == 401) {
                    this._umbracoCookie = undefined;
                    return this.doFetch<T>(relativeUrl, init);
                }
                
                let body = await response.text();
                if (body.startsWith(")]}',")) {
                    body = body.substring(5);
                }
                throw new UmbracoApiError(response.status, response.statusText, body);
            }
    
            let responseText = await response.text();
            if (responseText.startsWith(")]}',")) {
                responseText = responseText.substring(5);
            }
    
            return responseText;
        }
        catch (error) {
            vscode.window.showErrorMessage(`Umbraco API error ${error}`)
            throw error;
        }
    }
}

export class UmbracoApiError extends Error {
    constructor(public status: number, public statusText: string, public body: string) {
        super(`${status}: ${statusText}\n${body}`);
    }
}