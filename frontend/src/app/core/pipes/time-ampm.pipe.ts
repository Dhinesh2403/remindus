import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'timeAmPm', standalone: true })
export class TimeAmPmPipe implements PipeTransform {
  transform(time: string | undefined | null): string {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour   = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
  }
}
