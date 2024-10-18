import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import * as L from 'leaflet';
import * as CryptoJS from 'crypto-js'; // Importing from crypto-js
import { HttpClient } from '@angular/common/http'; // Import HttpClient for API calls

@Component({
  selector: 'app-grapicalmap',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './grapicalmap.component.html',
  styleUrls: ['./grapicalmap.component.scss']
})
export class GrapicalmapComponent {
  map!: L.Map;
  private key = 'GTt8Njnc3Z7P';  // Your API key
  private secret = 'JqbpMSopmwISsVBWvyEmywPEbePUoW6lkbxGH0h1Um';  // Your API secret
  private wmsBaseUrl = 'https://api.velocityweather.com/v1';
  private productCode = 'C09-0x0316-0'; // Example Product Code
  private configurationCode = 'Standard-Mercator'; // Example Config Code
  private latestTimeStep: string = ''; // Store latest time step

  constructor(private http: HttpClient) {} // Inject HttpClient

  ngAfterViewInit(): void {
    this.initMap();
  }

  initMap(): void {
    this.map = L.map('map', { zoomControl: false, attributionControl: false }).setView([20.5937, 78.9629], 5);

    // Define your base layers
    const streets = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    });

    const darkMatter = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {});
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {});
    const navigation = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
      maxZoom: 16
    });
  
    this.getAvailableTimeSteps().then(() => {
      this.addWmsLayer();  // Add WMS layer once the time steps are available
    });

    const baseMaps = {
      'Streets': streets,
      'Satellite': satellite,
      'Navigation': navigation,
      'Dark': darkMatter,
    };

    // Control for layers
    L.control.layers(baseMaps, {}, { position: 'topleft' }).addTo(this.map);
    streets.addTo(this.map);
    L.control.scale({ position: 'bottomright', metric: false }).addTo(this.map);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);
  }

  private addWmsLayer(): void {
    if (!this.latestTimeStep || this.latestTimeStep === '') {
      console.error("No valid time step available to add WMS layer.");
      return; // Exit the function if latestTimeStep is undefined or empty
    }
  
    const timeStep = this.latestTimeStep; // Use the dynamically fetched time step
    const timestamp = Math.floor(Date.now() / 1000).toString(); // Get the current timestamp in seconds
    const signature = this.signRequest(this.key, timestamp); // Generate the HMAC signature
  
    // Construct the WMS URL with only necessary parameters
    const wmsUrl = `https://api.velocityweather.com/v1/${this.key}/wms/${this.productCode}/${this.configurationCode}?VERSION=1.3.0&SERVICE=WMS&REQUEST=GetMap&CRS=EPSG:3857&LAYERS=${timeStep}&BBOX=-19000030.25383,-747262.291898,-2929909.4293921,1042110.4783351&WIDTH=256&HEIGHT=256&TIME=${timeStep}&ts=${timestamp}&sig=${signature}&FORMAT=image/png&TRANSPARENT=true`;
  
    // Log the URL for debugging
    console.log("Updated WMS URL:", wmsUrl);
  
    // Create WMS Layer with the correct URL and avoid setting duplicate parameters
    const wmsLayer = L.tileLayer.wms(wmsUrl, {
      format: 'image/png',
      transparent: true,
      attribution: '© Velocity Weather',
      crs: L.CRS.EPSG3857
    });
  
    // Add WMS layer to the map
    wmsLayer.addTo(this.map);
  }
  

  private async getAvailableTimeSteps(): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000).toString(); // Current timestamp in seconds
    const signature = this.signRequest(this.key, timestamp);

    // Build the GetCapabilities URL
    const capabilitiesUrl = `${this.wmsBaseUrl}/${this.key}/wms/${this.productCode}/${this.configurationCode}?VERSION=1.3.0&SERVICE=WMS&REQUEST=GetCapabilities&ts=${timestamp}&sig=${signature}`;

    // Log the URL for debugging
    console.log("GetCapabilities URL:", capabilitiesUrl);

    try {
      // Fetch the response, ensuring it's not undefined
      const response: string | undefined = await this.http.get(capabilitiesUrl, { responseType: 'text' }).toPromise();

      if (response) { // Ensure the response is defined before passing it to parseTimeStep
        const parsedResult = this.parseTimeStep(response); // Extract the issue time and time step

        if (parsedResult && parsedResult.timeStep) {
          // If parsedResult is not undefined, assign its timeStep to latestTimeStep
          this.latestTimeStep = parsedResult.timeStep; // Ensure latestTimeStep is a string
          console.log("Latest Time Step:", this.latestTimeStep);
        } else {
          console.error("No valid time step found in the response.");
          this.latestTimeStep = '';  // Assign a default value if needed
        }
      } else {
        console.error("Empty or undefined response received from GetCapabilities request.");
      }
    } catch (error) {
      console.error("Error fetching capabilities:", error); // Log error details
    }
  }

  private parseTimeStep(response: string): { issueTime: string, timeStep: string } {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(response, 'application/xml');
    const layers = xmlDoc.getElementsByTagName('Layer');

    if (layers.length > 0) {
      // Extracting the most recent layer for issue time and time step
      const firstLayer = layers[0];
      const nameElement = firstLayer.getElementsByTagName('Name')[0];  // Issue time
      const issueTime = nameElement?.textContent?.trim() || '';

      // Collecting the time steps from the subsequent layers
      const timeSteps: string[] = [];
      for (let i = 0; i < layers.length; i++) {
        const layerName = layers[i].getElementsByTagName('Name')[0]?.textContent?.trim();
        if (layerName) {
          timeSteps.push(layerName);
        }
      }

      // Returning the issue time and the first time step, or a default if empty
      return { issueTime: issueTime || 'default-issue-time', timeStep: timeSteps[0] || 'default-time-step' };
    }

    console.error('No layers found in GetCapabilities response');
    return { issueTime: 'default-issue-time', timeStep: 'default-time-step' };  // Return default values in case of failure
  }

  private signRequest(key: string, timestamp: string): string {
    const message = `${key}:${timestamp}`;
    const hash = CryptoJS.HmacSHA1(message, this.secret);
    const base64Signature = CryptoJS.enc.Base64.stringify(hash);
    const modifiedSignature = base64Signature.replace(/\//g, '_').replace(/\+/g, '-');
    console.log("Generated Signature:", modifiedSignature); // Log the generated signature
    return modifiedSignature;
  }
}
