import mongoose from 'mongoose';

export interface IServerConfig extends mongoose.Document {
    approvedChannels: string[];
    id: string | undefined;
    prefix: string;
}

export const ServerConfigModel = mongoose.model<IServerConfig>('serverConfig', new mongoose.Schema({
    approvedChannels: Array,
    id: String || undefined,
    prefix: String,
}), 'serverConfig');
