import mongoose from 'mongoose';

export interface IServerConfig extends mongoose.Document {
    id: string | undefined;
    prefix: string;
}

export const ServerConfigModel = mongoose.model<IServerConfig>('serverConfig', new mongoose.Schema({
    id: String || undefined,
    prefix: String,
}), 'serverConfig');
