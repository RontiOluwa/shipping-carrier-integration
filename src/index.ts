
import { UPSCarrier } from './carriers/ups/ups-carrier';
import { RateRequest, RateQuote } from './domain/models/rate';
import {
    CarrierError,
    CarrierValidationError,
    CarrierAuthError,
    CarrierNetworkError,
    CarrierRateLimitError,
} from './domain/models/error';

async function main() {
    // Initialize the UPS carrier
    const carrier = new UPSCarrier({
        clientId: process.env.UPS_CLIENT_ID || 'your-client-id',
        clientSecret: process.env.UPS_CLIENT_SECRET || 'your-client-secret',
        accountNumber: process.env.UPS_ACCOUNT_NUMBER || 'your-account',
    });

    const basicRequest: RateRequest = {
        origin: {
            street1: '123 Main St',
            city: 'San Francisco',
            state: 'CA',
            postalCode: '94105',
            country: 'US',
        },
        destination: {
            street1: '456 Market St',
            city: 'New York',
            state: 'NY',
            postalCode: '10001',
            country: 'US',
        },
        packages: [
            {
                weight: 5,
                weightUnit: 'LB',
                dimensions: {
                    length: 12,
                    width: 8,
                    height: 6,
                    unit: 'IN',
                },
            },
        ],
    };

    try {
        console.log('Fetching rates for basic shipment...');
        const quotes = await carrier.getRates(basicRequest);

        console.log(`Found ${quotes.length} rate quotes:`);
        quotes.forEach((quote: RateQuote) => {
            console.log(`  - ${quote.service}: $${quote.totalCharge.toFixed(2)} ${quote.currency}`);
            if (quote.deliveryDays) {
                console.log(`    Delivery: ${quote.deliveryDays} business days`);
            }
        });
    } catch (error) {
        handleError(error);
    }

    // Example 2: Request with specific service level
    const groundOnlyRequest: RateRequest = {
        ...basicRequest,
        serviceLevel: 'GROUND',
    };

    try {
        console.log('\nFetching ground shipping rate only...');
        const quotes = await carrier.getRates(groundOnlyRequest);

        if (quotes.length > 0) {
            const quote = quotes[0];
            console.log(`Ground rate: $${quote?.totalCharge.toFixed(2)}`);
        } else {
            console.log('No ground shipping available for this route');
        }
    } catch (error) {
        handleError(error);
    }

    // Example 3: Multiple packages
    const multiPackageRequest: RateRequest = {
        ...basicRequest,
        packages: [
            {
                weight: 5,
                weightUnit: 'LB',
                dimensions: { length: 12, width: 8, height: 6, unit: 'IN' },
            },
            {
                weight: 10,
                weightUnit: 'LB',
                dimensions: { length: 16, width: 12, height: 8, unit: 'IN' },
            },
            {
                weight: 3,
                weightUnit: 'LB',
                dimensions: { length: 8, width: 6, height: 4, unit: 'IN' },
            },
        ],
    };

    try {
        console.log('\nFetching rates for multiple packages...');
        const quotes = await carrier.getRates(multiPackageRequest);

        console.log(`Found ${quotes.length} rate quotes for 3 packages:`);
        quotes.forEach((quote: RateQuote) => {
            console.log(`  - ${quote.service}: $${quote.totalCharge.toFixed(2)}`);
        });
    } catch (error) {
        handleError(error);
    }
}


function handleError(error: unknown): void {
    if (error instanceof CarrierValidationError) {
        console.error('Validation Error:', error.message);
        if (error.validationErrors) {
            console.error('Details:', error.validationErrors);
        }
    } else if (error instanceof CarrierAuthError) {
        console.error('Authentication Error:', error.message);
        console.error('Please check your UPS credentials');
    } else if (error instanceof CarrierRateLimitError) {
        console.error('Rate Limit Error:', error.message);
        if (error.retryAfter) {
            console.error(`Retry after ${error.retryAfter} seconds`);
        }
    } else if (error instanceof CarrierNetworkError) {
        console.error('Network Error:', error.message);
        if (error.statusCode) {
            console.error(`Status Code: ${error.statusCode}`);
        }
    } else if (error instanceof CarrierError) {
        console.error('Carrier Error:', error.message);
        console.error('Code:', error.code);
    } else {
        console.error('Unexpected Error:', error);
    }
}

if (require.main === module) {
    main().catch(console.error);
}

export { main };