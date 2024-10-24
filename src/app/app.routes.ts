import { Routes } from '@angular/router';
import { BaronweatherComponent } from './baronweather/baronweather.component';
import { GrapicalmapComponent } from './grapicalmap/grapicalmap.component';

export const routes: Routes = [
    { path: '', redirectTo: '', pathMatch: 'full' }, 
    { path: '', component: GrapicalmapComponent },
];
