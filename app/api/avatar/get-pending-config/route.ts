import { NextRequest, NextResponse } from "next/server";
import { getConfigUpdate } from "@/app/lib/sessionConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
	try {
		const searchParams = request.nextUrl.searchParams;
		const customSessionId = searchParams.get("customSessionId");

		if (!customSessionId || customSessionId.trim().length === 0) {
			return NextResponse.json(
				{
					error: "`customSessionId` query parameter is required",
				},
				{ status: 400 },
			);
		}

		const config = await getConfigUpdate(customSessionId.trim());

		if (!config) {
			return NextResponse.json(
				{
					config: null,
				},
				{ status: 200 },
			);
		}

		return NextResponse.json(
			{
				config,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error("Error getting pending config:", error);

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

