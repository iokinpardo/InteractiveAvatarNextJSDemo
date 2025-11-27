import { NextResponse } from "next/server";
import { listActiveMappings } from "@/app/lib/sessionMapping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
	try {
		const mappings = await listActiveMappings();

		return NextResponse.json(
			{
				ok: true,
				mappings,
				count: mappings.length,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error("Error listing active mappings:", error);

		return NextResponse.json(
			{
				error: "Internal server error",
				message:
					error instanceof Error ? error.message : "Unknown error occurred",
			},
			{ status: 500 },
		);
	}
}

