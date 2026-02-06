# Shipping Carrier Integration Service

A production-ready TypeScript service for integrating with shipping carriers, starting with UPS Rating API.

## Architecture & Design Decisions

### Core Design Principles

1. **Carrier Abstraction Layer**: All carriers implement a common `ICarrier` interface, making it trivial to add FedEx, USPS, DHL, etc.

2. **Domain-Driven Design**: Clear separation between:

   - **Domain Models**: Internal representation (Address, Package, RateRequest, RateQuote)
   - **External Models**: Carrier-specific API formats
   - **Mappers**: Transform between domain and carrier formats

3. **Dependency Injection**: Services receive their dependencies, making testing and extension easier.

4. **Token Management**: OAuth lifecycle is completely transparent to consumers via `IAuthProvider` interface.

5. **Layered Error Handling**:
   - Network errors → `CarrierNetworkError`
   - Auth errors → `CarrierAuthError`
   - Validation errors → `CarrierValidationError`
   - Business errors → `CarrierRateLimitError`, `CarrierBusinessError`, etc.

### Project Structure

```
src/
├── carriers/
│   ├── base/
│   │   ├── carrier.interface.ts       # Core carrier contract
│   │   ├── auth.interface.ts          # Auth provider contract
│   │   └── types.ts                   # Shared carrier types
│   └── ups/
│       ├── ups-carrier.ts             # UPS carrier implementation
│       ├── ups-auth.ts                # UPS OAuth 2.0 provider
│       ├── ups-types.ts               # UPS API types
│       └── ups-mapper.ts              # Domain ↔ UPS transformations
├── domain/
│   └── models/
│       ├── address.ts                 # Address domain model
│       ├── package.ts                 # Package domain model
│       ├── rate.ts                    # Rate request/quote models
│       └── error.ts                   # Structured error types
├── config/
│   └── config.ts                      # Environment configuration
└── utils/
    └── http-client.ts                 # Axios wrapper with retry logic

tests/
└── integration/
    ├── ups-carrier.test.ts            # End-to-end carrier tests
    └── ups-auth.test.ts               # Auth lifecycle tests
```

### Technology Choices

- **Zod**: Runtime validation that stays in sync with TypeScript types
- **Axios**: Robust HTTP client with interceptor support for auth
- **Vitest**: Fast, modern test runner with great TypeScript support

### Key Features

#### 1. Extensibility

Adding a new carrier requires:

```typescript
class FedExCarrier implements ICarrier {
  readonly name = "FedEx";

  async getRates(request: RateRequest): Promise<RateQuote[]> {
    // FedEx-specific implementation
  }
}
```

Adding a new operation to UPS:

```typescript
class UPSCarrier implements ICarrier {
  async getRates(...) { /* existing */ }
  async purchaseLabel(...) { /* new operation */ }
  async trackShipment(...) { /* new operation */ }
}
```

#### 2. Token Lifecycle Management

```typescript
// Automatically handles:
// - Initial token acquisition
// - Caching valid tokens
// - Refreshing expired tokens
// - Concurrent request deduplication
const token = await authProvider.getToken();
```

#### 3. Strong Type Safety

```typescript
// Domain types are validated at runtime
const request: RateRequest = {
  origin: {
    /* ... */
  },
  destination: {
    /* ... */
  },
  packages: [{ weight: 5, weightUnit: "LB" }],
};

// Compile-time and runtime validation
RateRequestSchema.parse(request);
```

#### 4. Comprehensive Error Handling

```typescript
try {
  const rates = await carrier.getRates(request);
} catch (error) {
  if (error instanceof CarrierRateLimitError) {
    // Retry after delay
  } else if (error instanceof CarrierAuthError) {
    // Alert ops team
  }
}
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Update with your credentials (if available):

```
UPS_CLIENT_ID=your_client_id
UPS_CLIENT_SECRET=your_client_secret
UPS_ACCOUNT_NUMBER=your_account_number
UPS_API_BASE_URL=https://wwwcie.ups.com/api
UPS_TOKEN_URL=https://wwwcie.ups.com/security/v1/oauth/token
```

## Usage Example

```typescript
import { UPSCarrier } from "./carriers/ups/ups-carrier";
import { RateRequest } from "./domain/models/rate";

// Initialize carrier
const carrier = new UPSCarrier({
  clientId: process.env.UPS_CLIENT_ID!,
  clientSecret: process.env.UPS_CLIENT_SECRET!,
  accountNumber: process.env.UPS_ACCOUNT_NUMBER!,
});

// Request rates
const request: RateRequest = {
  origin: {
    street1: "123 Main St",
    city: "San Francisco",
    state: "CA",
    postalCode: "94105",
    country: "US",
  },
  destination: {
    street1: "456 Market St",
    city: "New York",
    state: "NY",
    postalCode: "10001",
    country: "US",
  },
  packages: [
    {
      weight: 5,
      weightUnit: "LB",
      dimensions: {
        length: 12,
        width: 8,
        height: 6,
        unit: "IN",
      },
    },
  ],
  serviceLevel: "GROUND", // Optional
};

try {
  const quotes = await carrier.getRates(request);
  console.log("Available rates:", quotes);
} catch (error) {
  console.error("Failed to get rates:", error);
}
```

## Testing Strategy

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Integration Tests

All tests use stubbed HTTP responses from actual UPS documentation:

1. **Happy Path**: Valid requests → successful rate quotes
2. **Auth Lifecycle**: Token acquisition → caching → expiry → refresh
3. **Error Scenarios**: Network failures, 4xx/5xx, malformed JSON, rate limits
4. **Validation**: Invalid inputs rejected before API calls

### Test Coverage

The test suite covers:

- ✅ Successful rate quote retrieval
- ✅ Single and multiple package handling
- ✅ Service level filtering
- ✅ Residential address handling
- ✅ Input validation (missing fields, invalid values)
- ✅ OAuth token acquisition and caching
- ✅ Token refresh on expiry
- ✅ Concurrent request deduplication
- ✅ 401 retry with token refresh
- ✅ UPS business errors
- ✅ Network timeouts
- ✅ Rate limiting (429)
- ✅ Server errors (5xx)
- ✅ Malformed responses
- ✅ Request payload building

## What I Would Improve With More Time

### 1. Advanced Features

- **Retry Strategy**: Exponential backoff with jitter for transient failures
- **Circuit Breaker**: Fail fast when carrier is consistently down
- **Request Deduplication**: Cache identical rate requests for 30s
- **Batch Operations**: Support multiple rate requests in one call

### 2. Observability

- **Structured Logging**: Winston or Pino with correlation IDs
- **Metrics**: Track latency, error rates, token refresh frequency
- **Distributed Tracing**: OpenTelemetry for request flow visibility
- **Health Checks**: Endpoint to verify carrier connectivity

### 3. Additional Operations

- **Label Purchase**: `purchaseLabel(shipmentRequest)`
- **Tracking**: `trackShipment(trackingNumber)`
- **Address Validation**: `validateAddress(address)`
- **Pickup Scheduling**: `schedulePickup(pickupRequest)`

### 4. Enhanced Error Recovery

- **Automatic Retry**: For specific error codes (503, 429)
- **Fallback Carriers**: If UPS fails, try FedEx automatically
- **Partial Success Handling**: Some quotes succeed, others fail

### 5. Performance

- **Connection Pooling**: Reuse HTTP connections
- **Parallel Requests**: Fetch multiple carriers concurrently
- **Response Caching**: Redis for frequently-requested routes
- **Rate Quote Comparison**: Automatically find cheapest option

### 6. Security

- **Secrets Rotation**: Support runtime credential updates
- **Request Signing**: HMAC verification for webhooks
- **Rate Limiting**: Protect our service from abuse
- **Audit Logging**: Track all carrier interactions

### 7. Additional Carriers

```typescript
// Easy to add new carriers following the same pattern
const fedexCarrier = new FedExCarrier(config);
const uspsCarrier = new USPSCarrier(config);
const dhlCarrier = new DHLCarrier(config);

// Or use a factory
const carrier = CarrierFactory.create("ups", config);
```

## API Documentation

### ICarrier Interface

```typescript
interface ICarrier {
  /**
   * Get shipping rate quotes for a shipment
   */
  getRates(request: RateRequest): Promise<RateQuote[]>;

  /**
   * Get carrier identifier
   */
  readonly name: string;
}
```

### Domain Models

#### Address

```typescript
interface Address {
  street1: string;
  street2?: string;
  street3?: string;
  city: string;
  state?: string; // US state code
  postalCode: string;
  country: string; // ISO 3166-1 alpha-2
  residential?: boolean;
}
```

#### Package

```typescript
interface Package {
  weight: number;
  weightUnit: "LB" | "KG" | "OZ";
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: "IN" | "CM";
  };
  insuredValue?: number;
  currency?: string;
  referenceNumber?: string;
}
```

#### RateRequest

```typescript
interface RateRequest {
  origin: Address;
  destination: Address;
  packages: Package[];
  serviceLevel?: ServiceLevel;
  shipmentDate?: Date;
  pickupType?: "DAILY_PICKUP" | "ONE_TIME_PICKUP" | "DROP_OFF";
  paymentType?: "SENDER" | "RECEIVER" | "THIRD_PARTY";
}
```

#### RateQuote

```typescript
interface RateQuote {
  carrier: string;
  service: string;
  serviceCode: string;
  serviceLevel?: ServiceLevel;
  totalCharge: number;
  baseCharge?: number;
  currency: string;
  deliveryDate?: Date;
  deliveryDays?: number;
  guaranteedDelivery?: boolean;
  rateId?: string;
  disclaimer?: string;
  additionalCharges?: Array<{
    type: string;
    amount: number;
  }>;
}
```

## Contributing

When adding a new carrier:

1. Implement `ICarrier` interface
2. Create carrier-specific types based on their API
3. Build mappers for domain ↔ carrier format
4. Implement auth if needed (inherit from `IAuthProvider`)
5. Write integration tests with stubbed responses
6. Document any carrier-specific quirks
