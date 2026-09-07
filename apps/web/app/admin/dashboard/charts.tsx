'use client';

import dynamic from 'next/dynamic';
import type { ApexOptions } from 'apexcharts';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface SeriesPoint {
  date: string;
  value: number;
}

function jalaliLabel(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'numeric', day: 'numeric' }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

export function RevenueChart({ data }: { data: SeriesPoint[] }): JSX.Element {
  const options: ApexOptions = {
    chart: { id: 'revenue', fontFamily: 'Vazirmatn, Tahoma' },
    xaxis: { categories: data.map((d) => jalaliLabel(d.date)) },
    yaxis: { labels: { formatter: (v: number) => v.toLocaleString('fa-IR') } },
    stroke: { curve: 'smooth' },
  };
  return <Chart options={options} series={[{ name: 'درآمد (تومان)', data: data.map((d) => d.value) }]} type="line" height={280} />;
}

export function UsersChart({ data }: { data: SeriesPoint[] }): JSX.Element {
  const options: ApexOptions = {
    chart: { id: 'users', fontFamily: 'Vazirmatn, Tahoma' },
    xaxis: { categories: data.map((d) => jalaliLabel(d.date)) },
  };
  return <Chart options={options} series={[{ name: 'کاربران جدید', data: data.map((d) => d.value) }]} type="bar" height={280} />;
}

export function GroupDonut({ data }: { data: Array<{ group: string; total: number }> }): JSX.Element {
  const options: ApexOptions = {
    chart: { id: 'groups', fontFamily: 'Vazirmatn, Tahoma' },
    labels: data.map((d) => d.group),
    legend: { position: 'bottom' },
  };
  return <Chart options={options} series={data.map((d) => d.total)} type="donut" height={280} />;
}

export function SubsChart({ data }: { data: SeriesPoint[] }): JSX.Element {
  const options: ApexOptions = {
    chart: { id: 'subs', fontFamily: 'Vazirmatn, Tahoma' },
    xaxis: { categories: data.map((d) => jalaliLabel(d.date)) },
    stroke: { curve: 'smooth' },
  };
  return <Chart options={options} series={[{ name: 'اشتراک‌های جدید', data: data.map((d) => d.value) }]} type="area" height={280} />;
}
