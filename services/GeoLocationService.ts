import { Reader } from '@maxmind/geoip2-node'
import { ApiError } from '../middleware/errorHandler.js'

export interface GeoLocationData {
  country: {
    isoCode: string | null
    name: string | null
  }
  city: {
    name: string | null
  }
  location: {
    latitude: number | null
    longitude: number | null
    timeZone: string | null
  }
  continent: {
    code: string | null
    name: string | null
  }
  subdivisions: Array<{
    isoCode: string | null
    name: string | null
  }>
  postal: {
    code: string | null
  }
  registeredCountry: {
    isoCode: string | null
    name: string | null
  }
}

class GeoLocationServiceClass {
  private reader: any = null
  private readonly databasePath: string

  constructor() {
    // Default database path - can be overridden via environment variable
    this.databasePath = process.env.GEOIP_DATABASE_PATH || '/path/to/maxmind-database.mmdb'
  }

  /**
   * Initialize the GeoIP database reader
   * This should be called once during application startup
   */
  async initialize(): Promise<void> {
    try {
      this.reader = await Reader.open(this.databasePath)
      console.log('GeoIP database reader initialized successfully')
    } catch (error) {
      console.error('Failed to initialize GeoIP database reader:', error)
      throw new ApiError('Failed to initialize GeoIP database', 500)
    }
  }

  /**
   * Get geolocation data for an IP address
   * @param ipAddress - The IP address to geolocate
   * @returns Promise<GeoLocationData> - The geolocation data
   */
  async getLocationByIP(ipAddress: string): Promise<GeoLocationData> {
    if (!this.reader) {
      throw new ApiError('GeoIP database reader not initialized', 500)
    }

    try {
      // Validate IP address format
      if (!this.isValidIP(ipAddress)) {
        throw new ApiError('Invalid IP address format', 400)
      }

      const response = this.reader.city(ipAddress)

      return {
        country: {
          isoCode: response.country?.isoCode || null,
          name: response.country?.names?.en || response.country?.name || null
        },
        city: {
          name: response.city?.names?.en || response.city?.name || null
        },
        location: {
          latitude: response.location?.latitude || null,
          longitude: response.location?.longitude || null,
          timeZone: response.location?.timeZone || null
        },
        continent: {
          code: response.continent?.code || null,
          name: response.continent?.names?.en || response.continent?.name || null
        },
        subdivisions: (response.subdivisions || []).map((subdivision: any) => ({
          isoCode: subdivision.isoCode || null,
          name: subdivision.names?.en || subdivision.name || null
        })),
        postal: {
          code: response.postal?.code || null
        },
        registeredCountry: {
          isoCode: response.registeredCountry?.isoCode || null,
          name: response.registeredCountry?.names?.en || response.registeredCountry?.name || null
        }
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      
      console.error('Error fetching geolocation data:', error)
      throw new ApiError('Failed to fetch geolocation data', 500)
    }
  }

  /**
   * Get country information only for an IP address (faster lookup)
   * @param ipAddress - The IP address to geolocate
   * @returns Promise with country information
   */
  async getCountryByIP(ipAddress: string): Promise<{ country: GeoLocationData['country'] }> {
    if (!this.reader) {
      throw new ApiError('GeoIP database reader not initialized', 500)
    }

    try {
      // Validate IP address format
      if (!this.isValidIP(ipAddress)) {
        throw new ApiError('Invalid IP address format', 400)
      }

      const response = this.reader.country(ipAddress)

      return {
        country: {
          isoCode: response.country?.isoCode || null,
          name: response.country?.names?.en || response.country?.name || null
        }
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error
      }
      
      console.error('Error fetching country data:', error)
      throw new ApiError('Failed to fetch country data', 500)
    }
  }

  /**
   * Validate IP address format (both IPv4 and IPv6)
   * @param ip - The IP address to validate
   * @returns boolean - Whether the IP address is valid
   */
  private isValidIP(ip: string): boolean {
    // IPv4 regex
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    
    // IPv6 regex (simplified)
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip)
  }

  /**
   * Close the database reader
   * Should be called during application shutdown
   */
  close(): void {
    if (this.reader) {
      // The reader doesn't have an explicit close method, but we can null it
      this.reader = null
      console.log('GeoIP database reader closed')
    }
  }
}

// Export a singleton instance
export const GeoLocationService = new GeoLocationServiceClass() 