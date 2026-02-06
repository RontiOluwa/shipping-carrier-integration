import { RateRequest, RateQuote } from '../../domain/models/rate';

export interface ICarrier {

    readonly name: string;

    getRates(request: RateRequest): Promise<RateQuote[]>;

    canService?(origin: string, destination: string): Promise<boolean>;
}