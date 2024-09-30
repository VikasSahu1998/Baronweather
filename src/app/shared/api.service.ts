import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import * as CryptoJS from 'crypto-js';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private apiKey = 'nnwIuwizRz4S';  // Your API Key
  private apiSecret = 'ZsEketBVyBEjtScGBtG3x6XDjxFrwKjJVRtyB38hQZ';  // Your API Secret
  private baseUrl = 'http://api.velocityweather.com/v1/';

  constructor(private http: HttpClient) { }

  // Function to generate the signature
  private signRequest(url: string): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();  // POSIX timestamp in seconds
    const stringToSign = `${this.apiKey}:${timestamp}`;

    // HMAC-SHA1 signing and Base64 encoding
    const hmac = CryptoJS.HmacSHA1(stringToSign, this.apiSecret);
    const base64Signature = CryptoJS.enc.Base64.stringify(hmac);

    // Replace special characters as required
    const modifiedSignature = base64Signature.replace(/\//g, '_').replace(/\+/g, '-');

    // Add signature and timestamp to the URL
    const queryChar = url.includes('?') ? '&' : '?';
    return `${url}${queryChar}sig=${modifiedSignature}&ts=${timestamp}`;
  }

  // Existing method to fetch METAR weather data
  getWeatherData(lat: number, lon: number): Observable<any> {
    const timestamp = Math.floor(Date.now() / 1000).toString();  // Current timestamp
    const endpoint = `${this.apiKey}/reports/metar/nearest.json`;
    const signedUrl = this.signRequest(`${this.baseUrl}${endpoint}?lat=${lat}&lon=${lon}&within_radius=500&max_age=360&from=${timestamp}`);
    return this.http.get<any>(signedUrl);
  }

  // New method to fetch NDFD hourly data
  getNDFD(lat: number, lon: number, hours: number, utcDate: string): Observable<any> {
    const timestamp = Math.floor(Date.now() / 1000).toString();  // Current timestamp
    const endpoint = `${this.apiKey}/reports/ndfd/hourly.json`;

    // Construct the URL with lat, lon, hours, and utc date as per your structure
    const url = `${this.baseUrl}${endpoint}?lat=${lat}&lon=${lon}&hours=${hours}&utc=${utcDate}`;

    // Sign the request with the timestamp and signature
    const signedUrl = this.signRequest(url);

    // Make the HTTP GET request
    return this.http.get<any>(signedUrl);
  }
}
