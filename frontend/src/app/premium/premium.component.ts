// src/app/premium/premium.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-premium',
  standalone: true,
  imports: [CommonModule, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/app/home" text=""></ion-back-button></ion-buttons>
        <ion-title>Go Premium</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="premium-content">
      <div class="hero">
        <div class="hero-emoji">⭐</div>
        <h1 class="hero-title">Remindus Premium</h1>
        <p class="hero-sub">Unlock powerful features to never miss a thing</p>
      </div>

      <div class="features-list">
        @for (f of features; track f.title) {
          <div class="feature-row">
            <span class="feature-icon">{{ f.icon }}</span>
            <div class="feature-info">
              <div class="feature-title">{{ f.title }}</div>
              <div class="feature-desc">{{ f.desc }}</div>
            </div>
          </div>
        }
      </div>

      <div class="plans">
        <div class="plan active-plan">
          <div class="plan-name">Monthly</div>
          <div class="plan-price">₹149<span>/mo</span></div>
          <button class="btn-upgrade">Get Monthly</button>
        </div>
        <div class="plan best-plan">
          <div class="best-badge">Best Value</div>
          <div class="plan-name">Yearly</div>
          <div class="plan-price">₹999<span>/yr</span></div>
          <div class="plan-save">Save 44%</div>
          <button class="btn-upgrade btn-upgrade-best">Get Yearly</button>
        </div>
      </div>

      <p class="legal">Cancel anytime. Prices in INR. No hidden fees.</p>
      <div style="height:32px"></div>
    </ion-content>`,
  styles: [`
    .premium-content { --background:var(--rm-bg); }
    ion-toolbar { --background:var(--rm-card); }
    .hero { background:linear-gradient(135deg,#3D5AF1,#5B7CFF); padding:40px 24px 32px; text-align:center; }
    .hero-emoji { font-size:56px; margin-bottom:12px; }
    .hero-title { font-size:24px; font-weight:900; color:white; margin-bottom:8px; }
    .hero-sub { font-size:14px; color:rgba(255,255,255,.8); }
    .features-list { padding:20px 16px; display:flex; flex-direction:column; gap:12px; }
    .feature-row { background:var(--rm-card); border-radius:16px; padding:16px; display:flex; gap:14px; align-items:flex-start; box-shadow:var(--rm-shadow-sm); }
    .feature-icon { font-size:28px; flex-shrink:0; }
    .feature-title { font-size:15px; font-weight:700; color:var(--rm-text-primary); margin-bottom:3px; }
    .feature-desc { font-size:13px; color:var(--rm-text-muted); }
    .plans { display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:0 16px 16px; }
    .plan { background:var(--rm-card); border-radius:20px; padding:20px 16px; text-align:center; border:2px solid var(--rm-border); box-shadow:var(--rm-shadow-sm); position:relative; }
    .best-plan { border-color:var(--rm-purple); background:var(--rm-purple-light); }
    .best-badge { position:absolute; top:-10px; left:50%; transform:translateX(-50%); background:var(--rm-purple); color:white; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:700; white-space:nowrap; }
    .plan-name { font-size:13px; font-weight:600; color:var(--rm-text-muted); margin-bottom:8px; }
    .plan-price { font-size:28px; font-weight:900; color:var(--rm-text-primary); margin-bottom:4px; }
    .plan-price span { font-size:14px; font-weight:500; color:var(--rm-text-muted); }
    .plan-save { font-size:12px; font-weight:700; color:var(--rm-success); margin-bottom:12px; }
    .btn-upgrade { width:100%; padding:12px; background:var(--rm-surface); color:var(--rm-purple); border:2px solid var(--rm-purple); border-radius:12px; font-size:13px; font-weight:700; cursor:pointer; font-family:inherit; margin-top:8px; }
    .btn-upgrade-best { background:var(--rm-purple); color:white; }
    .legal { text-align:center; font-size:12px; color:var(--rm-text-muted); padding:0 16px; }
  `],
})
export class PremiumComponent {
  features = [
    { icon: '📱', title: 'WhatsApp Reminders',  desc: 'Get reminders directly on WhatsApp' },
    { icon: '💬', title: 'SMS Notifications',   desc: 'Never miss reminders even offline' },
    { icon: '🤖', title: 'AI Smart Scheduling', desc: 'Let AI find the perfect time for tasks' },
    { icon: '♾️', title: 'Unlimited Reminders', desc: 'No cap on reminders or friends' },
    { icon: '🎯', title: 'Priority Support',    desc: '24/7 dedicated premium support' },
  ];
}
