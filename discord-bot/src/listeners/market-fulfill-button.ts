import { Listener, container } from '@sapphire/framework';
import { Events, type Interaction } from 'discord.js';

export class MarketFulfillButtonListener extends Listener<typeof Events.InteractionCreate> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.InteractionCreate,
    });
  }

  public override async run(interaction: Interaction): Promise<void> {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('market_fulfill:')) return;

    const orderId = parseInt(interaction.customId.split(':')[1], 10);
    if (isNaN(orderId)) {
      await interaction.reply({ content: '❌ Invalid order reference.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const result = await container.backendApi.fulfillMarketOrder(orderId, interaction.user.id);

      if (result.manual) {
        await interaction.editReply('⚠️ This is a materials order — please send the items manually in SWC, then confirm on the site.');
      } else {
        await interaction.editReply('✅ Done! The item has been transferred to the buyer.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong.';
      await interaction.editReply(`❌ ${message}`);
    }
  }
}
