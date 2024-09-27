import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BaronweatherComponent } from './baronweather.component';

describe('BaronweatherComponent', () => {
  let component: BaronweatherComponent;
  let fixture: ComponentFixture<BaronweatherComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BaronweatherComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BaronweatherComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
