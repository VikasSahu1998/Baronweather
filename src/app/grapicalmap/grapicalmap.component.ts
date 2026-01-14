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
    { name: 'Wind/Temp (3kft)', value: 'gfs-halfdeg-winduv-temp-c-3kft-msl' },
    { name: 'Volcanic Eruption', value: 'volcanic-eruption' }
  ];

  productCode = this.productCodes[0].value;
  private configurationCode = 'Standard-Mercator';

  private latestTimeStep = '';
  private wmsLayer?: L.TileLayer.WMS;
  private legendControl?: L.Control;

  windSpeedLegend: WindLegendEntry[] = [];
  displayedLegend: WindLegendEntry[] = [];
  showFullLegend = false;

  // Time Scale Properties
  forecastTimes: string[] = [];
  selectedTime = '';
  isPlaying = false;
  private animationInterval: any;

  // Date Selection Properties
  uniqueDates: string[] = [];
  selectedDate = '';
  showCalendar = false;

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.loadWindSpeedLegend();
  }

  ngAfterViewInit(): void {
    this.initMap();
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

  /* ---------------- TIME CONTROL ---------------- */

  onTimeChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.selectedTime = target.value;
    this.addWmsLayer(); // Refresh layer with new time
  }

  get displayedTime(): string {
    if (!this.selectedTime) return '';
    const date = new Date(this.selectedTime);
    return isNaN(date.getTime()) ? '' : date.toLocaleString();
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

  public addWmsLayer(): void {
    if (!this.latestTimeStep) return;

    // Use selected forecast time if available, otherwise fallback to model run time (latestTimeStep)
    // IMPORTANT: For forecast products, TIME parameter is crucial.
    const timeParam = this.selectedTime || this.latestTimeStep;

    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = this.signRequest(this.key, ts);

    const url = `${this.wmsBaseUrl}/${this.key}/wms/${this.productCode}/${this.configurationCode}` +
      `?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
      `&CRS=EPSG:3857&LAYERS=${this.latestTimeStep}` +
      `&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true` +
      `&TIME=${timeParam}&ts=${ts}&sig=${sig}`;

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
    if (this.productCode === 'gfs-windspeed-mph-10meter' && this.windSpeedLegend.length > 0) {
      // Show only key values for better readability
      const keyValues = [0, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200, 220, 240, 255];
      this.displayedLegend = this.windSpeedLegend.filter(entry => {
        const speed = parseInt(entry.value.replace(' mph', ''));
        return keyValues.includes(speed);
      });

      // default to collapsed values for now as we might use them for labels next to gradient
      const collapsedValues = [0, 10, 20, 30, 50, 70, 100, 150, 200, 255];
      this.displayedLegend = this.windSpeedLegend.filter(entry => {
        const speed = parseInt(entry.value.replace(' mph', ''));
        return collapsedValues.includes(speed);
      });
    } else {
      this.displayedLegend = [];
    }
  }

  get gradientStyle(): string {
    if (!this.windSpeedLegend || this.windSpeedLegend.length === 0) return '';
    // Create a linear gradient string from bottom to top
    // entries are usually in order of value.
    // We want the gradient to match the values.
    // valid entries have color and value.
    const stops = this.windSpeedLegend.map((entry, index) => {
      // Distribute stops evenly or based on value?
      // For simplicity and to match the visual of "equal steps", we can distribute evenly.
      // Or we can try to respect the value scale. Wind speed is non-linear in visualization often,
      // but here the legend entries provided seem to be the discrete steps.
      // Let's just create a stop for each color.

      // If we want a smooth gradient, we just list colors.
      // If we want discrete blocks like the original but "continuous looking", we can use hard stops.

      // The request is "vertical gradient bar".
      return entry.color;
    });

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

  selectNextTime(): void {
    const nextIndex = this.globalIndex + 1;
    if (nextIndex < this.forecastTimes.length) {
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
    let hours = date.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    return hours + ' ' + ampm;
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

  toggleCalendar(): void {
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
    this.http
      .get<any>('Wind Speed Near Surface/Wind Speed Near Surface.json')
      .subscribe(res => {
        if (res.palettes && res.palettes[0] && res.palettes[0].entries) {
          this.windSpeedLegend = res.palettes[0].entries.map((entry: any) => ({
            color: entry.color,
            value: entry.value,
            speed: parseInt(entry.value.replace(' mph', ''))
          }));
          this.updateDisplayedLegend();
        }
      });
  }

  /* ---------------- TIME STEPS ---------------- */

  private async getAvailableTimeSteps(): Promise<void> {
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = this.signRequest(this.key, ts);

    // Switch to Product Instances API (JSON) as it provides reliable valid_times
    const url = `${this.wmsBaseUrl}/${this.key}/meta/tiles/product-instances/${this.productCode}/${this.configurationCode}.json` +
      `?ts=${ts}&sig=${sig}`;

    try {
      const res: any[] = await this.http.get<any[]>(url).toPromise() || [];

      if (res && res.length > 0) {
        const latestInstance = res[0];
        this.latestTimeStep = latestInstance.time;

        if (latestInstance.valid_times && Array.isArray(latestInstance.valid_times)) {
          // efficient way to reverse-chronological -> chronological
          this.forecastTimes = [...latestInstance.valid_times].reverse();

          // Extract unique dates
          const dates = new Set(this.forecastTimes.map(t => t.split('T')[0]));
          this.uniqueDates = Array.from(dates);

          if (this.forecastTimes.length > 0) {
            this.selectedTime = this.forecastTimes[0];
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

  /* ---------------- SIGNATURE ---------------- */

  private signRequest(key: string, ts: string): string {
    return CryptoJS.enc.Base64.stringify(
      CryptoJS.HmacSHA1(`${key}:${ts}`, this.secret)
    )
      .replace(/\//g, '_')
      .replace(/\+/g, '-');
  }
}