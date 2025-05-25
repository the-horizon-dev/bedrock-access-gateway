declare module '@aws-sdk/client-bedrock' {
  export class BedrockClient {
    constructor(config: any);
    send(command: any): Promise<any>;
  }
  export class ListFoundationModelsCommand {
    constructor(args: any);
  }
}
