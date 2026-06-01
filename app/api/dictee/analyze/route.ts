import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, texteOriginal, mediaType } = await request.json();

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system:
        "Tu es un correcteur de dictée expert. Compare le texte manuscrit de l'image avec le texte original fourni. Identifie toutes les fautes d'orthographe, de grammaire et de conjugaison. Pour chaque faute, indique : le mot incorrect écrit par le joueur, le mot correct, et si la faute est certaine (rouge) ou borderline à cause de l'écriture illisible (jaune). Réponds uniquement en JSON.",
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: (mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp') || 'image/jpeg',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `Texte original de la dictée :\n"${texteOriginal}"\n\nAnalyse l'image et retourne UNIQUEMENT un JSON valide avec ce format :\n{"fautes": [{"mot_incorrect": "...", "mot_correct": "...", "certitude": "rouge" ou "jaune"}], "texte_transcrit": "..."}`,
            },
          ],
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      return NextResponse.json({ fautes: [], texte_transcrit: '' });
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ fautes: [], texte_transcrit: content.text });
    }

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Dictée analyze error:', error);
    return NextResponse.json({ fautes: [], texte_transcrit: '' }, { status: 500 });
  }
}
