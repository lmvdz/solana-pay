import { PublicKey } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { URL_PROTOCOL } from './constants';

/**
 * Optional query parameters to encode in a Solana Pay URL.
 */
export interface EncodePayURLParams {
    /** `amount` in the [Solana Pay spec](https://github.com/solana-labs/solana-pay/blob/master/SPEC.md#amount) */
    amount?: BigNumber;
    /** `splToken` in the [Solana Pay spec](https://github.com/solana-labs/solana-pay/blob/master/SPEC.md#spl-token) */
    splToken?: PublicKey;
    /** `reference` in the [Solana Pay spec](https://github.com/solana-labs/solana-pay/blob/master/SPEC.md#reference) */
    reference?: PublicKey | PublicKey[];
    /** `label` in the [Solana Pay spec](https://github.com/solana-labs/solana-pay/blob/master/SPEC.md#label) */
    label?: string;
    /** `message` in the [Solana Pay spec](https://github.com/solana-labs/solana-pay/blob/master/SPEC.md#message)  */
    message?: string;
    /** `memo` in the [Solana Pay spec](https://github.com/solana-labs/solana-pay/blob/master/SPEC.md#memo) */
    memo?: string;
}

/**
 * Required and optional URL components to encode in a Solana Pay URL.
 */
export interface EncodePayURLComponents extends EncodePayURLParams {
    /** `recipient` in the [Solana Pay spec](https://github.com/solana-labs/solana-pay/blob/master/SPEC.md#recipient) */
    recipient: PublicKey;
}

export type EncodeMintURLParams = {
    candymachineId: PublicKey,
    config: PublicKey,
    treasury: PublicKey
    /** `reference` in the [Solana Pay spec](https://github.com/solana-labs/solana-pay/blob/master/SPEC.md#reference) */
    reference?: PublicKey | PublicKey[];
    /** `label` in the [Solana Pay spec](https://github.com/solana-labs/solana-pay/blob/master/SPEC.md#label) */
    label?: string;
    /** `message` in the [Solana Pay spec](https://github.com/solana-labs/solana-pay/blob/master/SPEC.md#message)  */
    message?: string;
    /** `memo` in the [Solana Pay spec](https://github.com/solana-labs/solana-pay/blob/master/SPEC.md#memo) */
    memo?: string;
}

export interface EncodeMintURLComponents extends EncodeMintURLParams {
    /** `recipient` in the [Solana Pay spec](https://github.com/solana-labs/solana-pay/blob/master/SPEC.md#recipient) */
    recipient: PublicKey;
}

export function encodeMintURL({ recipient, ...params} : EncodeMintURLComponents) : string {
    let url = URL_PROTOCOL + encodeURIComponent(recipient.toBase58());

    const encodedParams = encodeMintURLParams(params);
    if (encodedParams) {
        url += '?' + encodedParams;
    }

    return url;
}

function encodeMintURLParams({ candymachineId, config, treasury, reference, label, message, memo }: EncodeMintURLParams): string {
    const params: [string, string][] = [];



    if (candymachineId) {
        params.push(['spl-token', candymachineId.toBase58()]);
    }


    if (config) {
        params.push(['spl-token', config.toBase58()]);
    }

    if (treasury) {
        params.push(['spl-token', treasury.toBase58()]);
    }

    if (reference) {
        if (!Array.isArray(reference)) {
            reference = [reference];
        }

        for (const pubkey of reference) {
            params.push(['reference', pubkey.toBase58()]);
        }
    }

    if (label) {
        params.push(['label', label]);
    }

    if (message) {
        params.push(['message', message]);
    }

    if (memo) {
        params.push(['memo', memo]);
    }
    

    return params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
}



/**
 * Encode a Solana Pay URL from required and optional components.
 *
 * @param {EncodeURLComponents} components
 *
 * @param components.recipient
 * @param components.amount
 * @param components.splToken
 * @param components.reference
 * @param components.label
 * @param components.message
 * @param components.memo
 */
export function encodePayURL({ recipient, ...params }: EncodePayURLComponents): string {
    let url = URL_PROTOCOL + encodeURIComponent(recipient.toBase58());

    const encodedParams = encodePayURLParams(params);
    if (encodedParams) {
        url += '?' + encodedParams;
    }

    return url;
}

function encodePayURLParams({ amount, splToken, reference, label, message, memo }: EncodePayURLParams): string {
    const params: [string, string][] = [];

    if (amount) {
        params.push(['amount', amount.toFixed(amount.decimalPlaces())]);
    }

    if (splToken) {
        params.push(['spl-token', splToken.toBase58()]);
    }

    if (reference) {
        if (!Array.isArray(reference)) {
            reference = [reference];
        }

        for (const pubkey of reference) {
            params.push(['reference', pubkey.toBase58()]);
        }
    }

    if (label) {
        params.push(['label', label]);
    }

    if (message) {
        params.push(['message', message]);
    }

    if (memo) {
        params.push(['memo', memo]);
    }

    return params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
}
