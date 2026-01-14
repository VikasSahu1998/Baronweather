import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import * as L from 'leaflet';
import * as CryptoJS from 'crypto-js';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-grapical-forecastmap',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './grapical-forecastmap.component.html',
  styleUrl: './grapical-forecastmap.component.scss'
})
export class GrapicalForecastmapComponent {
  map!: L.Map;
  private key = 'GTt8Njnc3Z7P';
  private secret = 'JqbpMSopmwISsVBWvyEmywPEbePUoW6lkbxGH0h1Um';
  private wmsBaseUrl = 'https://api.velocityweather.com/v1';
  // private productCode = 'wafs-hires-icing-fl240'; 
  private productCode = 'wafs-hires-turbulence-fl300';
  private configurationCode = 'Standard-Mercator';
  private latestIssueTime: string = ''; // Issue time (when forecast was made)
  private latestValidTime: string = ''; // Valid time (future forecasted time)

  constructor(private http: HttpClient) { }

  ngAfterViewInit(): void {
    this.initMap();
  }

  initMap(): void {
    this.map = L.map('map', { zoomControl: false, attributionControl: false }).setView([20.5937, 78.9629], 5);

    // Define base layers
    const streets = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    });

    const darkMatter = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {});
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {});
    const navigation = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
      maxZoom: 16
    });

    // Get available time steps before adding WMS layer
    this.getAvailableTimeSteps().then(() => {
      this.addWmsLayer();
    });

    const baseMaps = {
      'Streets': streets,
      'Satellite': satellite,
      'Navigation': navigation,
      'Dark': darkMatter,
    };

    L.control.layers(baseMaps, {}, { position: 'topleft' }).addTo(this.map);
    streets.addTo(this.map);
    L.control.scale({ position: 'bottomright', metric: false }).addTo(this.map);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
  }

  private addWmsLayer(): void {
    if (!this.latestIssueTime || !this.latestValidTime) {
      console.error("No valid issue time or valid time available to add WMS layer.");
      return;
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this.signRequest(this.key, timestamp);

    // For forecast products, LAYERS should be the issue time (when forecast was made)
    // and TIME should be the valid time (the forecasted future time)
    const wmsUrl = `${this.wmsBaseUrl}/${this.key}/wms/${this.productCode}/${this.configurationCode}`;

    console.log("Issue Time (LAYERS):", this.latestIssueTime);
    console.log("Valid Time (TIME):", this.latestValidTime);
    console.log("Base WMS URL:", wmsUrl);

    // Create WMS Layer - Leaflet will append bbox and other parameters
    const wmsLayer = L.tileLayer.wms(wmsUrl, {
      layers: this.latestIssueTime,  // Issue time from GetCapabilities
      format: 'image/png',
      version: '1.3.0',
      service: 'WMS',
      request: 'GetMap',
      crs: L.CRS.EPSG3857,
      transparent: true,
      attribution: '© Velocity Weather',
      // Custom parameters for Baron Weather API
      time: this.latestValidTime,  // Valid time for forecast products (WMS-T)
      ts: timestamp,
      sig: signature
    } as any); // Cast to any to allow custom parameters

    wmsLayer.addTo(this.map);
  }

  private async getAvailableTimeSteps(): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this.signRequest(this.key, timestamp);

    // Try Product Instances API first (more reliable for forecast products)
    try {
      await this.getTimeStepsFromProductInstances(timestamp, signature);
      if (this.latestIssueTime && this.latestValidTime) {
        console.log("Successfully fetched time steps from Product Instances API");
        return;
      }
    } catch (error) {
      console.warn("Product Instances API failed, trying GetCapabilities:", error);
    }

    // Fallback to GetCapabilities
    try {
      await this.getTimeStepsFromCapabilities(timestamp, signature);
    } catch (error) {
      console.error("Both API methods failed:", error);
    }
  }

  private async getTimeStepsFromProductInstances(timestamp: string, signature: string): Promise<void> {
    const instancesUrl = `${this.wmsBaseUrl}/${this.key}/meta/tiles/product-instances/${this.productCode}/${this.configurationCode}.json?ts=${timestamp}&sig=${signature}`;

    console.log("Product Instances URL:", instancesUrl);

    const response: any = await this.http.get(instancesUrl).toPromise();

    if (response && Array.isArray(response) && response.length > 0) {
      const latestInstance = response[0];
      this.latestIssueTime = latestInstance.time;

      // Check if this is a forecast product (has valid_times array)
      if (latestInstance.valid_times && Array.isArray(latestInstance.valid_times) && latestInstance.valid_times.length > 0) {
        this.latestValidTime = latestInstance.valid_times[0]; // Most recent valid time
        console.log("Latest Issue Time:", this.latestIssueTime);
        console.log("All Valid Times:", latestInstance.valid_times);
        console.log("Latest Valid Time:", this.latestValidTime);
      } else {
        console.error("No valid_times found in Product Instances response");
        this.latestValidTime = '';
      }
    } else {
      console.error("Empty or invalid response from Product Instances API");
    }
  }

  private async getTimeStepsFromCapabilities(timestamp: string, signature: string): Promise<void> {
    // Build the GetCapabilities URL
    const capabilitiesUrl = `${this.wmsBaseUrl}/${this.key}/wms/${this.productCode}/${this.configurationCode}?VERSION=1.3.0&SERVICE=WMS&REQUEST=GetCapabilities&ts=${timestamp}&sig=${signature}`;

    console.log("GetCapabilities URL:", capabilitiesUrl);

    const response: string | undefined = await this.http.get(capabilitiesUrl, { responseType: 'text' }).toPromise();

    if (response) {
      const parsedResult = this.parseTimeSteps(response);

      if (parsedResult && parsedResult.issueTime && parsedResult.validTime) {
        this.latestIssueTime = parsedResult.issueTime;
        this.latestValidTime = parsedResult.validTime;
        console.log("Latest Issue Time:", this.latestIssueTime);
        console.log("Latest Valid Time:", this.latestValidTime);
      } else {
        console.error("No valid time steps found in GetCapabilities response.");
        this.latestIssueTime = '';
        this.latestValidTime = '';
      }
    } else {
      console.error("Empty or undefined response received from GetCapabilities request.");
    }
  }

  private parseTimeSteps(response: string): { issueTime: string, validTime: string } | null {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(response, 'application/xml');

    // Get all Layer elements
    const layers = xmlDoc.getElementsByTagName('Layer');

    // Look for layers with Name elements (these are requestable layers)
    for (let i = 0; i < layers.length; i++) {
      const nameElement = layers[i].getElementsByTagName('Name')[0];

      if (nameElement) {
        const issueTime = nameElement.textContent?.trim();

        // Look for Dimension element with name="time" within this layer
        const dimensions = layers[i].getElementsByTagName('Dimension');

        for (let j = 0; j < dimensions.length; j++) {
          const dimension = dimensions[j];

          if (dimension.getAttribute('name') === 'time') {
            const timeValues = dimension.textContent?.trim();

            if (timeValues && issueTime) {
              // Time values are comma-separated, get the first (most recent) one
              const validTimes = timeValues.split(',').map(t => t.trim()).filter(t => t.length > 0);

              // Filter out non-ISO8601 values (should start with a year like "20")
              const validIsoTimes = validTimes.filter(t => /^\d{4}-/.test(t));

              if (validIsoTimes.length > 0) {
                const validTime = validIsoTimes[0]; // Most recent valid time

                console.log("Found Issue Time:", issueTime);
                console.log("Found Valid Times:", validIsoTimes);
                console.log("Using Valid Time:", validTime);

                return { issueTime, validTime };
              }
            }
          }
        }
      }
    }

    console.error('No forecast layers with time dimension found in GetCapabilities response');
    console.log('Full XML Response:', response);
    return null;
  }

  private signRequest(key: string, timestamp: string): string {
    const message = `${key}:${timestamp}`;
    const hash = CryptoJS.HmacSHA1(message, this.secret);
    const base64Signature = CryptoJS.enc.Base64.stringify(hash);
    const modifiedSignature = base64Signature.replace(/\//g, '_').replace(/\+/g, '-');
    console.log("Generated Signature:", modifiedSignature);
    return modifiedSignature;
  }

}
