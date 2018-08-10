import mongoose from 'mongoose';

export interface IAddress extends mongoose.Document {
    address: string;
    id: string | undefined;
}

export const AddressModel = mongoose.model<IAddress>('address', new mongoose.Schema({
    address: String,
    id: String || undefined,
}), 'address');
