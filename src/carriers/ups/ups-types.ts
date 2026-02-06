
export interface UPSTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
}

export interface UPSAddress {
    AddressLine?: string[]; // Up to 3 address lines
    City: string;
    StateProvinceCode?: string;
    PostalCode: string;
    CountryCode: string;
    ResidentialAddressIndicator?: string; // Presence indicates residential
}

export interface UPSPackageWeight {
    Weight: string;
    UnitOfMeasurement: {
        Code: 'LBS' | 'KGS' | 'OZS';
        Description?: string;
    };
}
export interface UPSPackageDimensions {
    Length: string;
    Width: string;
    Height: string;
    UnitOfMeasurement: {
        Code: 'IN' | 'CM';
        Description?: string;
    };
}

export interface UPSPackage {
    PackagingType: {
        Code: string;
        Description?: string;
    };
    PackageWeight: UPSPackageWeight;
    Dimensions?: UPSPackageDimensions;
    PackageServiceOptions?: {
        DeclaredValue?: {
            CurrencyCode: string;
            MonetaryValue: string;
        };
    };
}

export interface UPSShipment {
    Shipper: {
        Name?: string;
        ShipperNumber?: string;
        Address: UPSAddress;
    };
    ShipTo: {
        Name?: string;
        Address: UPSAddress;
    };
    ShipFrom: {
        Name?: string;
        Address: UPSAddress;
    };
    Service?: {
        Code: string;
        Description?: string;
    };
    Package: UPSPackage[] | UPSPackage;
    ShipmentRatingOptions?: {
        NegotiatedRatesIndicator?: string;
    };
}


export interface UPSRateRequest {
    RateRequest: {
        Request: {
            TransactionReference?: {
                CustomerContext?: string;
            };
        };
        Shipment: UPSShipment;
    };
}

export interface UPSRatedShipment {
    Service: {
        Code: string;
        Description?: string;
    };
    RatedShipmentAlert?: Array<{
        Code: string;
        Description: string;
    }>;
    BillingWeight?: {
        UnitOfMeasurement: {
            Code: string;
        };
        Weight: string;
    };
    TransportationCharges?: {
        CurrencyCode: string;
        MonetaryValue: string;
    };
    ServiceOptionsCharges?: {
        CurrencyCode: string;
        MonetaryValue: string;
    };
    TotalCharges: {
        CurrencyCode: string;
        MonetaryValue: string;
    };
    GuaranteedDelivery?: {
        BusinessDaysInTransit: string;
        DeliveryByTime?: string;
    };
    TimeInTransit?: {
        ServiceSummary: {
            Service: {
                Description: string;
            };
            EstimatedArrival: {
                Arrival: {
                    Date: string;
                    Time: string;
                };
            };
        };
    };
    NegotiatedRateCharges?: {
        TotalCharge: {
            CurrencyCode: string;
            MonetaryValue: string;
        };
    };
    ItemizedCharges?: Array<{
        Code: string;
        CurrencyCode: string;
        MonetaryValue: string;
    }>;
}

export interface UPSRateResponse {
    RateResponse: {
        Response: {
            ResponseStatus: {
                Code: string;
                Description: string;
            };
            Alert?: Array<{
                Code: string;
                Description: string;
            }>;
        };
        RatedShipment: UPSRatedShipment | UPSRatedShipment[];
    };
}



export interface UPSErrorResponse {
    response: {
        errors: Array<{
            code: string;
            message: string;
        }>;
    };
}

export const UPS_SERVICE_CODES: Record<string, string> = {
    GROUND: '03',
    NEXT_DAY_AIR: '01',
    NEXT_DAY_AIR_SAVER: '13',
    SECOND_DAY_AIR: '02',
    SECOND_DAY_AIR_AM: '59',
    THREE_DAY_SELECT: '12',
    EXPRESS: '07',
    EXPRESS_PLUS: '54',
    STANDARD: '11',
};

/**
 * Reverse mapping: UPS codes to service names
 */
export const UPS_SERVICE_NAMES: Record<string, string> = {
    '01': 'UPS Next Day Air',
    '02': 'UPS Second Day Air',
    '03': 'UPS Ground',
    '07': 'UPS Worldwide Express',
    '08': 'UPS Worldwide Expedited',
    '11': 'UPS Standard',
    '12': 'UPS Three-Day Select',
    '13': 'UPS Next Day Air Saver',
    '14': 'UPS Next Day Air Early AM',
    '54': 'UPS Worldwide Express Plus',
    '59': 'UPS Second Day Air AM',
    '65': 'UPS Saver',
};