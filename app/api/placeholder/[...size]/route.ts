import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { size: string[] } }
) {
  try {
    const [width] = params.size;
    const w = parseInt(width) || 800;
    
    // 重定向到 Unsplash 佔位符圖片
    const unsplashUrl = `https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=${w}&q=80`;
    
    return NextResponse.redirect(unsplashUrl);
  } catch (error) {
    console.error('Error in placeholder API:', error);
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }
} 