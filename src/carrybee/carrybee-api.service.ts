import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class CarrybeeApiService {
  private readonly logger = new Logger(CarrybeeApiService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly clientContext: string;

  constructor(private configService: ConfigService) {
    const env = this.configService.get<string>('CARRYBEE_ENV', 'sandbox');
    
    if (env === 'production') {
      this.baseUrl = this.configService.get<string>('CARRYBEE_PRODUCTION_BASE_URL') || '';
      this.clientId = this.configService.get<string>('CARRYBEE_PRODUCTION_CLIENT_ID') || '';
      this.clientSecret = this.configService.get<string>('CARRYBEE_PRODUCTION_CLIENT_SECRET') || '';
      this.clientContext = this.configService.get<string>('CARRYBEE_PRODUCTION_CLIENT_CONTEXT') || '';
    } else {
      this.baseUrl = this.configService.get<string>(
        'CARRYBEE_SANDBOX_BASE_URL',
        'https://stage-sandbox.carrybee.com/'
      ) || 'https://stage-sandbox.carrybee.com/';
      this.clientId = this.configService.get<string>(
        'CARRYBEE_SANDBOX_CLIENT_ID',
        '1a89c1a6-fc68-4395-9c09-628e0d3eaafc'
      ) || '1a89c1a6-fc68-4395-9c09-628e0d3eaafc';
      this.clientSecret = this.configService.get<string>(
        'CARRYBEE_SANDBOX_CLIENT_SECRET',
        '1d7152c9-5b2d-4e4e-9c20-652b93333704'
      ) || '1d7152c9-5b2d-4e4e-9c20-652b93333704';
      this.clientContext = this.configService.get<string>(
        'CARRYBEE_SANDBOX_CLIENT_CONTEXT',
        'DzJwPsx31WaTbS745XZoBjmQLcNqwK'
      ) || 'DzJwPsx31WaTbS745XZoBjmQLcNqwK';
    }

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
      headers: {
        'Client-ID': this.clientId,
        'Client-Secret': this.clientSecret,
        'Client-Context': this.clientContext,
        'Content-Type': 'application/json',
      },
    });

    this.logger.log(`Carrybee API initialized (${env} mode)`);
  }

  // ===== LOCATION APIs =====

  async getCities() {
    try {
      const response = await this.axiosInstance.get('/api/v2/cities');
      return response.data.data.cities;
    } catch (error) {
      this.logger.error('Failed to get cities from Carrybee', error.message);
      throw error;
    }
  }

  async getZones(cityId: number) {
    try {
      const response = await this.axiosInstance.get(`/api/v2/cities/${cityId}/zones`);
      return response.data.data.zones;
    } catch (error) {
      this.logger.error(`Failed to get zones for city ${cityId}`, error.message);
      throw error;
    }
  }

  async getAreas(cityId: number, zoneId: number) {
    try {
      const response = await this.axiosInstance.get(
        `/api/v2/cities/${cityId}/zones/${zoneId}/areas`
      );
      return response.data.data.areas;
    } catch (error) {
      this.logger.error(`Failed to get areas for city ${cityId}, zone ${zoneId}`, error.message);
      throw error;
    }
  }

  async searchArea(query: string) {
    try {
      const response = await this.axiosInstance.get('/api/v2/area-suggestion', {
        params: { search: query },
      });
      return response.data.data.items;
    } catch (error) {
      this.logger.error(`Failed to search area: ${query}`, error.message);
      throw error;
    }
  }

  // ===== STORE APIs =====

  async createStore(data: {
    name: string;
    contact_person_name: string;
    contact_person_number: string;
    contact_person_secondary_number?: string;
    address: string;
    city_id: number;
    zone_id: number;
    area_id: number;
  }) {
    try {
      // Ensure proper data types and trim values
      const cleanData = {
        name: data.name.substring(0, 30).trim(),
        contact_person_name: data.contact_person_name.substring(0, 30).trim(),
        contact_person_number: data.contact_person_number,
        address: data.address.substring(0, 100).trim(),
        city_id: Number(data.city_id),
        zone_id: Number(data.zone_id),
        area_id: Number(data.area_id),
      };
      
      // Add secondary number only if provided
      if (data.contact_person_secondary_number) {
        (cleanData as any).contact_person_secondary_number = data.contact_person_secondary_number;
      }
      
      this.logger.log(`Carrybee createStore request: ${JSON.stringify(cleanData)}`);
      
      const response = await this.axiosInstance.post('/api/v2/stores', cleanData);
      this.logger.log(`Store created in Carrybee: ${data.name}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to create store in Carrybee: ${JSON.stringify(error.response?.data || error.message)}`);
      throw error;
    }
  }

  async getStores() {
    try {
      const response = await this.axiosInstance.get('/api/v2/stores');
      return response.data.data.stores;
    } catch (error) {
      this.logger.error('Failed to get stores from Carrybee', error.message);
      throw error;
    }
  }

  // ===== ORDER APIs =====

  async createOrder(data: {
    store_id: string;
    merchant_order_id?: string;
    delivery_type: number;
    product_type: number;
    recipient_phone: string;
    recipient_secendary_phone?: string;
    recipient_name: string;
    recipient_address: string;
    city_id: number;
    zone_id: number;
    area_id?: number;
    special_instruction?: string;
    product_description?: string;
    item_weight: number;
    item_quantity?: number;
    collectable_amount?: number;
  }) {
    try {
      // Remove undefined values from the request body
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined && v !== null && v !== '')
      );
      
      this.logger.log(`Carrybee createOrder request: ${JSON.stringify(cleanData)}`);
      
      const response = await this.axiosInstance.post('/api/v2/orders', cleanData);
      this.logger.log(`Order created in Carrybee: ${response.data.data.order.consignment_id}`);
      return response.data.data.order;
    } catch (error) {
      this.logger.error(`Failed to create order in Carrybee: ${JSON.stringify(error.response?.data || error.message)}`);
      throw error;
    }
  }

  async cancelOrder(consignmentId: string, reason: string) {
    try {
      const response = await this.axiosInstance.post(
        `/api/v2/orders/${consignmentId}/cancel`,
        { cancellation_reason: reason }
      );
      this.logger.log(`Order cancelled in Carrybee: ${consignmentId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to cancel order ${consignmentId}`, error.response?.data || error.message);
      throw error;
    }
  }

  async getOrderDetails(consignmentId: string) {
    try {
      const response = await this.axiosInstance.get(`/api/v2/orders/${consignmentId}/details`);
      return response.data.data;
    } catch (error) {
      this.logger.error(`Failed to get order details for ${consignmentId}`, error.message);
      throw error;
    }
  }

  // ===== HELPER FUNCTIONS =====

  formatPhoneForCarrybee(phone: string): string {
    if (!phone) return '';
    
    // Remove all non-digit characters (spaces, dashes, etc.)
    let cleaned = phone.replace(/\D/g, '');
    
    // Remove country code 880 if present
    if (cleaned.startsWith('880')) {
      cleaned = cleaned.substring(3);
    }
    // Remove country code 88 if present (without leading 0)
    else if (cleaned.startsWith('88') && cleaned.length > 11) {
      cleaned = cleaned.substring(2);
    }
    
    // Ensure it starts with 0 (Bangladesh local format)
    if (!cleaned.startsWith('0') && cleaned.length === 10) {
      cleaned = '0' + cleaned;
    }
    
    // Carrybee expects format like "01652241276" (11 digits starting with 01)
    this.logger.debug(`Phone formatted for Carrybee: ${phone} -> ${cleaned}`);
    
    return cleaned;
  }

  convertWeightToGrams(weightInKg: number): number {
    const grams = Math.round(weightInKg * 1000);
    
    if (grams < 1 || grams > 25000) {
      throw new Error(`Weight must be between 0.001 kg and 25 kg (got ${weightInKg} kg)`);
    }
    
    return grams;
  }

  mapDeliveryType(deliveryType: number): number {
    // Your system: 1=Normal, 2=Express, 3=Same Day
    // Carrybee: 1=Normal, 2=Express
    if (deliveryType === 3) {
      return 2; // Map Same Day to Express
    }
    return deliveryType;
  }
}
