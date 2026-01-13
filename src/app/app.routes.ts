import { Routes } from '@angular/router';
import { BaronweatherComponent } from './baronweather/baronweather.component';
import { GrapicalmapComponent } from './grapicalmap/grapicalmap.component';
import { GrapicalForecastmapComponent } from './grapical-forecastmap/grapical-forecastmap.component';

export const routes: Routes = [
    { path: '', redirectTo: '', pathMatch: 'full' }, 
    { path: '', component: GrapicalForecastmapComponent },
];
