import { Keypair } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { encodePayURL } from '../src';

describe('encodeURL', () => {
    it('encodes a URL', () => {
        const recipient = Keypair.generate().publicKey;
        const amount = new BigNumber('0.000000001');
        const splToken = Keypair.generate().publicKey;
        const reference1 = Keypair.generate().publicKey;
        const reference2 = Keypair.generate().publicKey;

        const reference = [reference1, reference2];
        const label = 'label';
        const message = 'message';
        const memo = 'memo';

        const url = encodePayURL({ recipient, amount, splToken, reference, label, message, memo });

        expect(url).toBe(
            `solana:${recipient}?amount=0.000000001&spl-token=${splToken}&reference=${reference1}&reference=${reference2}&label=${label}&message=${message}&memo=${memo}`
        );
    });

    it('encodes a url with recipient', () => {
        const recipient = Keypair.generate().publicKey;

        const url = encodePayURL({ recipient });

        expect(url).toBe(`solana:${recipient}`);
    });

    it('encodes a url with recipient and amount', () => {
        const recipient = Keypair.generate().publicKey;
        const amount = new BigNumber('1');

        const url = encodePayURL({ recipient, amount });

        expect(url).toBe(`solana:${recipient}?amount=1`);
    });

    it('encodes a url with recipient, amount and token', () => {
        const recipient = Keypair.generate().publicKey;
        const amount = new BigNumber('1.01');
        const splToken = Keypair.generate().publicKey;

        const url = encodePayURL({ recipient, amount, splToken });

        expect(url).toBe(`solana:${recipient}?amount=1.01&spl-token=${splToken}`);
    });

    it('encodes a url with recipient, amount and references', () => {
        const recipient = Keypair.generate().publicKey;
        const amount = new BigNumber('100000.123456');
        const reference1 = Keypair.generate().publicKey;
        const reference = [reference1];

        const url = encodePayURL({ recipient, amount, reference });

        expect(url).toBe(`solana:${recipient}?amount=100000.123456&reference=${reference1}`);
    });

    it('encodes a url with recipient, amount and label', () => {
        const recipient = Keypair.generate().publicKey;
        const amount = new BigNumber('1.99');
        const label = 'label';

        const url = encodePayURL({ recipient, amount, label });

        expect(url).toBe(`solana:${recipient}?amount=1.99&label=${label}`);
    });

    it('encodes a url with recipient, amount and message', () => {
        const recipient = Keypair.generate().publicKey;
        const amount = new BigNumber('1');
        const message = 'message';

        const url = encodePayURL({ recipient, amount, message });

        expect(url).toBe(`solana:${recipient}?amount=1&message=${message}`);
    });

    it('encodes a url with recipient, amount and memo', () => {
        const recipient = Keypair.generate().publicKey;
        const amount = new BigNumber('100');
        const memo = 'memo';

        const url = encodePayURL({ recipient, amount, memo });

        expect(url).toBe(`solana:${recipient}?amount=100&memo=${memo}`);
    });
});
