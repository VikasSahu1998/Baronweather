import { Routes } from '@angular/router';
import { BaronweatherComponent } from './baronweather/baronweather.component';

export const routes: Routes = [
    { path: '', redirectTo: 'UsersLogin', pathMatch: 'full' }, 
    { path: '', component: BaronweatherComponent },
];
