import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GrapicalmapComponent } from './grapicalmap.component';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

describe('GrapicalmapComponent', () => {
  let component: GrapicalmapComponent;
  let fixture: ComponentFixture<GrapicalmapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GrapicalmapComponent, HttpClientModule, FormsModule]
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
