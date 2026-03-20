// QA 專區異常單選項頁面
'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Option {
	id: number;
	name: string;
	description?: string;
}

export default function QAOptionsPage() {
	const [options, setOptions] = useState<Option[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		// 取得 QA 專區異常單選項資料
		async function fetchOptions() {
			setLoading(true);
			const { data, error } = await supabase
				.from('qa_anomaly_options')
				.select('*')
				.order('id', { ascending: true });
			if (error) {
				setOptions([]);
			} else {
				setOptions(data || []);
			}
			setLoading(false);
		}
		fetchOptions();
	}, []);

	return (
		<div className="p-4">
			<h2 className="text-lg font-bold mb-4">QA 專區異常單選項</h2>
			{loading ? (
				<div>載入中...</div>
			) : (
				<table className="min-w-full border">
					<thead>
						<tr>
							<th className="border px-2 py-1">編號</th>
							<th className="border px-2 py-1">名稱</th>
							<th className="border px-2 py-1">說明</th>
						</tr>
					</thead>
					<tbody>
						{options.map(option => (
							<tr key={option.id}>
								<td className="border px-2 py-1">{option.id}</td>
								<td className="border px-2 py-1">{option.name}</td>
								<td className="border px-2 py-1">{option.description || '-'}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</div>
	);
}
