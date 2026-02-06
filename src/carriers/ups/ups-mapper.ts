import { Address } from '../../domain/models/address';
import { Package } from '../../domain/models/package';
import { RateRequest, RateQuote, ServiceLevel } from '../../domain/models/rate';
import {
    UPSAddress,
    UPSPackage,
    UPSRateRequest,
    UPSRatedShipment,
    UPS_SERVICE_CODES,
    UPS_SERVICE_NAMES,
} from './ups-types';

export class UPSMapper {

    static toUPSAddress(address: Address): UPSAddress {
        const addressLines: string[] = [address.street1];

        if (address.street2) {
            addressLines.push(address.street2);
        }
        if (address.street3) {
            addressLines.push(address.street3);
        }

        const upsAddress: UPSAddress = {
            City: address.city,
            PostalCode: address.postalCode,
            CountryCode: address.country,
        };

        if (addressLines.length > 0) {
            upsAddress.AddressLine = addressLines;
        }

        if (address.state) {
            upsAddress.StateProvinceCode = address.state;
        }

        if (address.residential) {
            upsAddress.ResidentialAddressIndicator = 'Y';
        }

        return upsAddress;
    }


    static toUPSPackage(pkg: Package, accountNumber?: string): UPSPackage {
        const upsPackage: UPSPackage = {
            PackagingType: {
                Code: '02', // Customer Supplied Package
                Description: 'Customer Supplied Package',
            },
            PackageWeight: {
                Weight: pkg.weight.toString(),
                UnitOfMeasurement: {
                    Code: pkg.weightUnit === 'LB' ? 'LBS' : pkg.weightUnit === 'OZ' ? 'OZS' : 'KGS',
                },
            },
        };

        // Add dimensions if provided
        if (pkg.dimensions) {
            upsPackage.Dimensions = {
                Length: pkg.dimensions.length.toString(),
                Width: pkg.dimensions.width.toString(),
                Height: pkg.dimensions.height.toString(),
                UnitOfMeasurement: {
                    Code: pkg.dimensions.unit,
                },
            };
        }

        // Add insured value if provided
        if (pkg.insuredValue) {
            upsPackage.PackageServiceOptions = {
                DeclaredValue: {
                    CurrencyCode: pkg.currency || 'USD',
                    MonetaryValue: pkg.insuredValue.toString(),
                },
            };
        }

        return upsPackage;
    }


    static toUPSRateRequest(
        request: RateRequest,
        accountNumber: string
    ): UPSRateRequest {
        const packages = request.packages.map(pkg =>
            this.toUPSPackage(pkg, accountNumber)
        );

        const upsRequest: UPSRateRequest = {
            RateRequest: {
                Request: {
                    TransactionReference: {
                        CustomerContext: 'Rating',
                    },
                },
                Shipment: {
                    Shipper: {
                        ShipperNumber: accountNumber,
                        Address: this.toUPSAddress(request.origin),
                    },
                    ShipTo: {
                        Address: this.toUPSAddress(request.destination),
                    },
                    ShipFrom: {
                        Address: this.toUPSAddress(request.origin),
                    },
                    Package: packages.length === 1 ? packages[0]! : packages,
                    ShipmentRatingOptions: {
                        NegotiatedRatesIndicator: 'Y',
                    },
                },
            },
        };

        // Add service level if specified
        if (request.serviceLevel) {
            const serviceCode = UPS_SERVICE_CODES[request.serviceLevel];
            if (serviceCode) {
                upsRequest.RateRequest.Shipment.Service = {
                    Code: serviceCode,
                };
            }
        }

        return upsRequest;
    }


    static toRateQuote(ratedShipment: UPSRatedShipment): RateQuote {
        const serviceCode = ratedShipment.Service.Code;
        const serviceName = UPS_SERVICE_NAMES[serviceCode] || ratedShipment.Service.Description || 'Unknown Service';

        // Use negotiated rates if available, otherwise use total charges
        const charges = ratedShipment.NegotiatedRateCharges?.TotalCharge || ratedShipment.TotalCharges;

        const quote: RateQuote = {
            carrier: 'UPS',
            service: serviceName,
            serviceCode: serviceCode,
            totalCharge: parseFloat(charges.MonetaryValue),
            currency: charges.CurrencyCode,
            guaranteedDelivery: false
        };

        // Map service code back to our ServiceLevel enum if possible
        quote.serviceLevel = this.getServiceLevel(serviceCode);

        // Add base charge if available
        if (ratedShipment.TransportationCharges) {
            quote.baseCharge = parseFloat(ratedShipment.TransportationCharges.MonetaryValue);
        }

        // Add delivery information
        if (ratedShipment.GuaranteedDelivery) {
            quote.deliveryDays = parseInt(ratedShipment.GuaranteedDelivery.BusinessDaysInTransit, 10);
            quote.guaranteedDelivery = true;
        }

        // Parse delivery date from TimeInTransit if available
        if (ratedShipment.TimeInTransit?.ServiceSummary?.EstimatedArrival?.Arrival) {
            const arrival = ratedShipment.TimeInTransit.ServiceSummary.EstimatedArrival.Arrival;
            try {
                quote.deliveryDate = new Date(arrival.Date);
            } catch {
                // Invalid date format, skip
            }
        }

        // Add itemized charges as additional charges
        if (ratedShipment.ItemizedCharges && ratedShipment.ItemizedCharges.length > 0) {
            quote.additionalCharges = ratedShipment.ItemizedCharges.map(charge => ({
                type: charge.Code,
                amount: parseFloat(charge.MonetaryValue),
            }));
        }

        // Add alerts as disclaimer if present
        if (ratedShipment.RatedShipmentAlert && ratedShipment.RatedShipmentAlert.length > 0) {
            quote.disclaimer = ratedShipment.RatedShipmentAlert
                .map(alert => alert.Description)
                .join('; ');
        }

        return quote;
    }

    private static getServiceLevel(serviceCode: string): ServiceLevel | undefined {
        const reverseMap: Record<string, ServiceLevel> = {
            '01': 'NEXT_DAY_AIR',
            '02': 'SECOND_DAY_AIR',
            '03': 'GROUND',
            '07': 'EXPRESS',
            '11': 'STANDARD',
            '12': 'THREE_DAY_SELECT',
            '13': 'NEXT_DAY_AIR_SAVER',
            '54': 'EXPRESS_PLUS',
            '59': 'SECOND_DAY_AIR_AM',
        };

        return reverseMap[serviceCode];
    }


    static normalizeRatedShipments(
        ratedShipment: UPSRatedShipment | UPSRatedShipment[]
    ): UPSRatedShipment[] {
        return Array.isArray(ratedShipment) ? ratedShipment : [ratedShipment];
    }
}