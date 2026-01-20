import { CommonModule } from '@angular/common';
import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import * as L from 'leaflet';
import * as CryptoJS from 'crypto-js';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

interface WindLegendEntry {
  color: string;
  value: string;
  speed: number;
}
interface TemperatureLegendEntry {
  color: string;
  value: string;
  temperature: number;
}


@Component({
  selector: 'app-grapicalmap',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './grapicalmap.component.html',
  styleUrls: ['./grapicalmap.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class GrapicalmapComponent implements OnInit {
  map!: L.Map;

  private key = 'GTt8Njnc3Z7P';
  private secret = 'JqbpMSopmwISsVBWvyEmywPEbePUoW6lkbxGH0h1Um';
  private wmsBaseUrl = 'https://api.velocityweather.com/v1';

  productCodes = [
    { name: 'Wind Speed Near Surface', value: 'gfs-windspeed-mph-10meter' },
    { name: 'Temperature (2m)', value: 'gfs-temp-f-2meter' },
    { name: 'Wind/Temp', value: 'gfs-halfdeg-winduv-temp-c-kft-msl' },
    { name: 'Volcanic Eruption', value: 'volcanic-eruption' }
  ];

  productCode = this.productCodes[0].value;
  selectedAltitude = 3; // Default to 3k feet
  private configurationCode = 'Standard-Mercator';

  private latestTimeStep = '';
  private wmsLayer?: L.TileLayer.WMS;
  private legendControl?: L.Control;
  windSpeedLegend: WindLegendEntry[] = [];
  temperatureLegend: TemperatureLegendEntry[] = [];
  displayedLegend: (WindLegendEntry | TemperatureLegendEntry)[] = [];
  legendTitle = '';
  showFullLegend = false;
  selectedTemperatureUnit: 'C' | 'F' = 'F'; // Default to Fahrenheit
  // Time Scale Properties
  forecastTimes: string[] = [];
  validServerTimes: string[] = []; // Store actual valid times from server
  selectedTime = '';


  isPlaying = false;
  private animationInterval: any;

  // Date Selection Properties
  uniqueDates: string[] = [];
  selectedDate = '';
  showCalendar = false;

  // Hover Time Display Properties
  hoverTime = '';
  isHoveringTimeline = false;
  hoverPosition = 0;

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.loadWindSpeedLegend();
    this.loadTemperatureLegend();
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  get isWindTempSelected(): boolean {
    return this.productCode === 'gfs-halfdeg-winduv-temp-c-kft-msl';
  }

  get isTemperatureSelected(): boolean {
    return this.productCode === 'gfs-temp-f-2meter';
  }

  private celsiusToFahrenheit(celsius: number): number {
    return Math.round((celsius * 9 / 5) + 32);
  }

  private fahrenheitToCelsius(fahrenheit: number): number {
    return Math.round((fahrenheit - 32) * 5 / 9);
  }

  /* ---------------- MAP INIT ---------------- */

  initMap(): void {
    this.map = L.map('map', { zoomControl: false, attributionControl: false })
      .setView([20.5937, 78.9629], 5);

    // Create a custom pane for weather layers to ensure they are always on top of base layers
    this.map.createPane('weatherPane');
    this.map.getPane('weatherPane')!.style.zIndex = '600'; // Higher than tilePane (200) and overlayPane (400)

    const streets = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(this.map);

    const darkMatter = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');
    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    );
    const navigation = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
    );

    L.control.layers(
      {
        Streets: streets,
        Satellite: satellite,
        Navigation: navigation,
        Dark: darkMatter
      },
      {},
      { position: 'topleft' }
    ).addTo(this.map);

    L.control.zoom({ position: 'topleft' }).addTo(this.map);
    L.control.scale({ position: 'topleft', metric: false }).addTo(this.map);
    this.legendControl = new L.Control({ position: 'topleft' });
    this.legendControl.onAdd = () => {
      const div = L.DomUtil.create('div', 'legend');
      div.style.display = 'none'; // Hide default leaflet legend
      return div;
    };
    this.legendControl.addTo(this.map);

    this.updateWmsLayer();
  }

  /* ---------------- PRODUCT CHANGE ---------------- */

  onProductChange(event: Event): void {
    this.productCode = (event.target as HTMLSelectElement).value;
    this.forecastTimes = [];
    this.uniqueDates = [];
    this.selectedTime = '';
    this.updateWmsLayer();
  }

  onAltitudeChange(event: Event): void {
    const newAltitude = parseInt((event.target as HTMLInputElement).value, 10);
    this.selectedAltitude = newAltitude;
    this.updateWmsLayer();
  }

  onTemperatureUnitChange(unit: 'C' | 'F'): void {
    this.selectedTemperatureUnit = unit;
    this.updateDisplayedLegend();
  }

  /* ---------------- TIME CONTROL ---------------- */

  onTimeChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.selectedTime = target.value;
    this.addWmsLayer(); // Refresh layer with new time
  }

  get displayedTime(): string {
    if (!this.selectedTime) return '';
    const date = new Date(this.selectedTime);
    if (isNaN(date.getTime())) return '';
    // Format as UTC time in ISO format
    return date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  }

  toggleAnimation(): void {
    if (this.isPlaying) {
      clearInterval(this.animationInterval);
      this.isPlaying = false;
    } else {
      this.isPlaying = true;
      const currentIndex = this.forecastTimes.indexOf(this.selectedTime);
      let nextIndex = currentIndex + 1;

      this.animationInterval = setInterval(() => {
        if (nextIndex >= this.forecastTimes.length) {
          nextIndex = 0;
        }
        this.selectedTime = this.forecastTimes[nextIndex];
        // Ensure selectedDate updates if we cross midnight during animation
        this.syncSelectedDate();
        this.addWmsLayer();
        nextIndex++;
      }, 2000); // Change every 2 seconds
    }
  }

  /* ---------------- WMS LAYER ---------------- */

  private async updateWmsLayer(): Promise<void> {
    await this.getAvailableTimeSteps();

    if (this.wmsLayer) {
      this.map.removeLayer(this.wmsLayer);
    }

    this.addWmsLayer();
    this.updateDisplayedLegend();
  }

  private getCurrentProductCode(): string {
    if (this.isWindTempSelected) {
      return `gfs-halfdeg-winduv-temp-c-${this.selectedAltitude}kft-msl`;
    }
    return this.productCode;
  }

  public addWmsLayer(): void {
    if (!this.latestTimeStep) return;

    // FIND NEAREST VALID TIME
    // If selectedTime is synthetic (XX:30), find the closest time in validServerTimes (XX:00)
    let timeParam = this.selectedTime || this.latestTimeStep;

    if (this.selectedTime && this.validServerTimes.length > 0) {
      const selected = new Date(this.selectedTime).getTime();
      // Find closest
      const closest = this.validServerTimes.reduce((prev, curr) => {
        const prevDiff = Math.abs(new Date(prev).getTime() - selected);
        const currDiff = Math.abs(new Date(curr).getTime() - selected);
        return currDiff < prevDiff ? curr : prev;
      });
      timeParam = closest;
    }

    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = this.signRequest(this.key, ts);
    const currentProduct = this.getCurrentProductCode();

    const url = `${this.wmsBaseUrl}/${this.key}/wms/${currentProduct}/${this.configurationCode}` +
      `?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
      `&CRS=EPSG:3857&LAYERS=${this.latestTimeStep}` +
      `&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true` +
      `&TIME=${timeParam}&ts=${ts}&sig=${sig}`;

    console.log('🗺️ WMS Layer URL:', url);
    console.log('📦 Product Code:', currentProduct);
    console.log('⌚ Time Parameter:', timeParam);

    // Remove existing layer if adding a new one to update time
    if (this.wmsLayer) {
      this.map.removeLayer(this.wmsLayer);
    }

    this.wmsLayer = L.tileLayer.wms(url, {
      layers: this.latestTimeStep,
      format: 'image/png',
      transparent: true,
      version: '1.3.0',
      pane: 'weatherPane' // Add to custom pane with high z-index
    });

    this.wmsLayer.addTo(this.map);
  }

  /* ---------------- CUSTOM LEGEND ---------------- */

  private updateDisplayedLegend(): void {
    this.displayedLegend = [];
    this.legendTitle = '';

    if (this.productCode === 'gfs-windspeed-mph-10meter' && this.windSpeedLegend.length > 0) {
      this.legendTitle = 'mph';
      const collapsedValues = [0, 10, 20, 30, 50, 70, 100, 150, 200, 255];
      this.displayedLegend = this.windSpeedLegend.filter(entry => {
        return collapsedValues.includes(entry.speed);
      });
    } else if (this.productCode === 'gfs-temp-f-2meter' && this.temperatureLegend.length > 0) {
      this.legendTitle = this.selectedTemperatureUnit === 'C' ? '°C' : '°F';

      // Always filter using Fahrenheit values
      const keyTempsF = [-120, -100, -80, -60, -40, -20, 0, 20, 40, 60, 80, 100, 120, 130];

      this.displayedLegend = this.temperatureLegend
        .filter(entry => keyTempsF.includes(entry.temperature))
        .map(entry => {
          if (this.selectedTemperatureUnit === 'C') {
            const celsiusTemp = this.fahrenheitToCelsius(entry.temperature);
            return {
              ...entry,
              value: `${celsiusTemp} °C`
            };
          }
          return {
            ...entry,
            value: `${entry.temperature} °F`
          };
        });
    }
  }



  get gradientStyle(): string {
      let legendData: (WindLegendEntry | TemperatureLegendEntry)[] = [];
      if (this.productCode === 'gfs-windspeed-mph-10meter') {
        legendData = this.windSpeedLegend;
      } else if (this.productCode === 'gfs-temp-f-2meter') {
        legendData = this.temperatureLegend;
      }

      if (!legendData || legendData.length === 0) return '';

      const stops = legendData.map(entry => entry.color);
      return `linear-gradient(to top, ${stops.join(', ')})`;
    }


  /* ---------------- TIMELINE & DATE HELPERS ---------------- */

  // Filter times for the currently selected date
  get currentDayTimes(): string[] {
      if (!this.selectedDate) return [];
      return this.forecastTimes.filter(time => time.startsWith(this.selectedDate));
    }

  // Current index within the filtered day list
  get currentIndex(): number {
      return this.currentDayTimes.indexOf(this.selectedTime);
    }

  // Global index for navigation
  get globalIndex(): number {
      return this.forecastTimes.indexOf(this.selectedTime);
    }

  // Calculate percentage position for current real-time indicator on timeline
  get currentTimePosition(): number {
      if (this.currentDayTimes.length < 2) return 0;

      const now = new Date().getTime();
      const start = new Date(this.currentDayTimes[0]).getTime();
      const end = new Date(this.currentDayTimes[this.currentDayTimes.length - 1]).getTime();

      // Check if "now" is within range of the current day being viewed
      if (now < start) return 0;
      if (now > end) return 100;

      return ((now - start) / (end - start)) * 100;
    }

    selectNextTime(): void {
      const nextIndex = this.globalIndex + 1;
      if(nextIndex <this.forecastTimes.length) {
      this.selectedTime = this.forecastTimes[nextIndex];
      this.syncSelectedDate();
      this.addWmsLayer();
    }
  }

  selectPrevTime(): void {
    const prevIndex = this.globalIndex - 1;
    if (prevIndex >= 0) {
      this.selectedTime = this.forecastTimes[prevIndex];
      this.syncSelectedDate();
      this.addWmsLayer();
    }
  }

  formatTickTime(timeStr: string): string {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    // Get UTC hours for display
    const utcHours = date.getUTCHours();
    const paddedHours = utcHours.toString().padStart(2, '0');
    const paddedMinutes = date.getUTCMinutes().toString().padStart(2, '0');
    console.log(`⏰ UTC Time: ${paddedHours}:${paddedMinutes}Z`);
    return paddedHours + ':' + paddedMinutes + 'Z';
  }

  onTimelineInput(event: Event): void {
    // The slider returns index within currentDayTimes
    const target = event.target as HTMLInputElement;
    const index = parseInt(target.value, 10);

    const dayTimes = this.currentDayTimes;
    if (index >= 0 && index < dayTimes.length) {
      this.selectedTime = dayTimes[index];
      this.addWmsLayer();
    }
  }

  onTimelineHover(event: MouseEvent): void {
    const slider = event.target as HTMLInputElement;
    if (!slider || this.currentDayTimes.length === 0) return;

    const rect = slider.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(100, (x / width) * 100));

    // Calculate which index this corresponds to
    const index = Math.round((percentage / 100) * (this.currentDayTimes.length - 1));

    if (index >= 0 && index < this.currentDayTimes.length) {
      const hoverTimeStr = this.currentDayTimes[index];
      const date = new Date(hoverTimeStr);
      const utcHours = date.getUTCHours();
      const utcMinutes = date.getUTCMinutes();
      const utcDate = date.getUTCDate();
      const utcMonth = (date.getUTCMonth() + 1).toString().padStart(2, '0');

      this.hoverTime = `${utcDate.toString().padStart(2, '0')}/${utcMonth} ${utcHours.toString().padStart(2, '0')}:${utcMinutes.toString().padStart(2, '0')}Z`;
      this.hoverPosition = percentage;
    }
  }

  onTimelineHoverEnd(): void {
    this.isHoveringTimeline = false;
    this.hoverTime = '';
  }

  onTimelineHoverStart(): void {
    this.isHoveringTimeline = true;
  } toggleCalendar(): void {
    this.showCalendar = !this.showCalendar;
  }

  selectDate(date: string): void {
    this.selectedDate = date;
    this.showCalendar = false;

    // Select first time of this date
    const times = this.currentDayTimes;
    if (times.length > 0) {
      this.selectedTime = times[0];
      this.addWmsLayer();
    }
  }

  private syncSelectedDate(): void {
    if (!this.selectedTime) return;
    // Extract YYYY-MM-DD from the selected time string (ISO format)
    // Assuming format 2026-01-14T...
    this.selectedDate = this.selectedTime.split('T')[0];
  }

  toggleLegendView(): void {
    this.showFullLegend = !this.showFullLegend;
    this.updateDisplayedLegend();
  }

  /* ---------------- LOAD LEGEND JSON ---------------- */

  private loadWindSpeedLegend(): void {
    const legendUrl = 'Wind Speed Near Surface/Wind Speed Near Surface.json';
    console.log('📊 Loading Wind Speed Legend from:', legendUrl);
    this.http
      .get<any>(legendUrl)
      .subscribe(res => {
        if (res.palettes && res.palettes[0] && res.palettes[0].entries) {
          this.windSpeedLegend = res.palettes[0].entries.map((entry: any) => ({
            color: entry.color,
            value: entry.value,
            speed: parseInt(entry.value.replace(' mph', ''))
          }));
          console.log('✅ Wind Speed Legend loaded successfully');
          this.updateDisplayedLegend();
        }
      });
  }
  private loadTemperatureLegend(): void {
    const legendUrl = 'Temperature/Temperature.json';
    console.log('📊 Loading Temperature Legend from:', legendUrl);
    this.http.get<any>(legendUrl).subscribe(res => {
      if (res.palettes && res.palettes[0] && res.palettes[0].entries) {
        this.temperatureLegend = res.palettes[0].entries.map((entry: any) => ({
          color: entry.color,
          value: entry.value,
          temperature: parseInt(entry.value.replace(' °F', ''), 10)
        }));
        console.log('✅ Temperature Legend loaded successfully');
        this.updateDisplayedLegend();
      }
    });
  }


  /* ---------------- TIME STEPS ---------------- */

  private async getAvailableTimeSteps(): Promise<void> {
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = this.signRequest(this.key, ts);
    const currentProduct = this.getCurrentProductCode();

    // Switch to Product Instances API (JSON) as it provides reliable valid_times
    const url = `${this.wmsBaseUrl}/${this.key}/meta/tiles/product-instances/${currentProduct}/${this.configurationCode}.json` +
      `?ts=${ts}&sig=${sig}`;

    console.log('⏱️ Fetching Available TimeSteps from:', url);

    try {
      const res: any[] = await this.http.get<any[]>(url).toPromise() || [];

      if (res && res.length > 0) {
        const latestInstance = res[0];
        this.latestTimeStep = latestInstance.time;

        if (latestInstance.valid_times && Array.isArray(latestInstance.valid_times) && latestInstance.valid_times.length > 0) {
          // Flatten standard times first
          const standardTimes = [...latestInstance.valid_times].reverse();
          this.validServerTimes = standardTimes; // Store raw valid times

          // Generate 30-minute intervals between start and end of forecast
          // Assuming timestamps are sortable strings (ISO)
          if (standardTimes.length >= 2) {
            const startTime = standardTimes[0];
            const endTime = standardTimes[standardTimes.length - 1];
            this.forecastTimes = this.generate30MinIntervals(startTime, endTime);
          } else {
            this.forecastTimes = standardTimes;
          }

          // Extract unique dates
          const dates = new Set(this.forecastTimes.map(t => t.split('T')[0]));
          this.uniqueDates = Array.from(dates);

          if (this.forecastTimes.length > 0) {
            // Default to current time rounded down to nearest 30 min
            const now = new Date();
            // Round down minutes to 0 or 30
            const minutes = now.getMinutes() >= 30 ? 30 : 0;
            now.setMinutes(minutes, 0, 0); // Seconds and ms to 0

            // Find closest matching time in forecastTimes
            const nowTime = now.getTime();
            let closestTime = this.forecastTimes[0];
            let minDiff = Infinity;

            for (const t of this.forecastTimes) {
              const diff = Math.abs(new Date(t).getTime() - nowTime);
              if (diff < minDiff) {
                minDiff = diff;
                closestTime = t;
              }
            }

            this.selectedTime = closestTime;
            this.syncSelectedDate();
          }
        } else {
          this.forecastTimes = [];
          this.selectedTime = '';
          this.uniqueDates = [];
        }
      }

    } catch (error) {
      console.error('Error fetching time steps:', error);
    }
  }

  private generate30MinIntervals(startStr: string, endStr: string): string[] {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const times = [];
    const current = new Date(start);

    while (current <= end) {
      times.push(current.toISOString());
      // Add 30 minutes
      current.setMinutes(current.getMinutes() + 30);
    }
    return times;
  }

  /* ---------------- SIGNATURE ---------------- */

  private signRequest(key: string, ts: string): string {
    return CryptoJS.enc.Base64.stringify(
      CryptoJS.HmacSHA1(`${key}:${ts}`, this.secret)
    )
      .replace(/\//g, '_')
      .replace(/\+/g, '-');
  }
}