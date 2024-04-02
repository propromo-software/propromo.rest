import { describe, expect, it } from 'bun:test';
import { app } from '../src';
import validator from 'html-validator';

describe('Propromo Rest-Microservice Tests (ElysiaJS Tests)', () => {
    it('root returns html info-page', async () => {
        try {
            const response = await app
                .handle(new Request('http://localhost:3000/'))
                .then(async (res) => res.text());

            const options = {
                // url: 'http://localhost:3000/', // depends on axios and would require to manually start the development server...
                // isLocal: true,
                data: response,
                ignore: ['Error: Element “ol” not allowed as child of element “ul” in this context. (Suppressing further errors from this subtree.)']
            }

            const result = await validator(options); // returns "The document validates according to the specified schema(s)." :skull:
            console.log(result);

            expect(result).toBeString();
        } catch (error) {
            console.error(error);
            expect(true).toBe(false);
        }
    })

    it('openapi specification is returned', async () => {
        const response = await app
            .handle(new Request('http://localhost:3000/api/json', {
                redirect: "follow" // redirects to the latest (/<latest_version>/api/json)
            }))
            .then(async (res) => {
                const response = await app
                    .handle(new Request(`http://localhost:3000${res.headers.get('location')}`))
                    .then((res) => res.json());
            
                return response;
            })
        
        expect(response).toBeObject();
    })
})
