import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GrapicalmapComponent } from './grapicalmap.component';

describe('GrapicalmapComponent', () => {
  let component: GrapicalmapComponent;
  let fixture: ComponentFixture<GrapicalmapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GrapicalmapComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GrapicalmapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
