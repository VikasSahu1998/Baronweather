import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GrapicalForecastmapComponent } from './grapical-forecastmap.component';

describe('GrapicalForecastmapComponent', () => {
  let component: GrapicalForecastmapComponent;
  let fixture: ComponentFixture<GrapicalForecastmapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GrapicalForecastmapComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GrapicalForecastmapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
