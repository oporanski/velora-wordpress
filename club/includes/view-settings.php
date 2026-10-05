<?php
/**
 * @package VeloraClubWidgets
 */

if (!defined('ABSPATH')) {
    exit;
}
?>
<div class="wrap">
    <h1><?php esc_html_e('Velora Club Widgets', 'velora-club-widgets'); ?></h1>

    <p>
        <?php esc_html_e('Configure the connection to your Velora club. The API key is required only for contact form submissions; read-only widgets (member breeders, events) work without one.', 'velora-club-widgets'); ?>
    </p>

    <form method="post" action="options.php">
        <?php settings_fields('velora_club'); ?>

        <table class="form-table">
            <tr>
                <th scope="row">
                    <label for="velora_club_api_base"><?php esc_html_e('API base URL', 'velora-club-widgets'); ?></label>
                </th>
                <td>
                    <input
                        type="url"
                        id="velora_club_api_base"
                        name="<?php echo esc_attr(Velora_Club_Plugin::OPTION_API_BASE); ?>"
                        value="<?php echo esc_attr(get_option(Velora_Club_Plugin::OPTION_API_BASE, 'https://velora.pet')); ?>"
                        class="regular-text"
                        placeholder="https://velora.pet"
                    />
                    <p class="description"><?php esc_html_e('Velora external API base.', 'velora-club-widgets'); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="velora_club_profile_base"><?php esc_html_e('Profile base URL', 'velora-club-widgets'); ?></label>
                </th>
                <td>
                    <input
                        type="url"
                        id="velora_club_profile_base"
                        name="<?php echo esc_attr(Velora_Club_Plugin::OPTION_PROFILE_BASE); ?>"
                        value="<?php echo esc_attr(get_option(Velora_Club_Plugin::OPTION_PROFILE_BASE, 'https://velora.pet')); ?>"
                        class="regular-text"
                        placeholder="https://velora.pet"
                    />
                    <p class="description"><?php esc_html_e('Public Velora portal URL. Card/row clicks open profiles here.', 'velora-club-widgets'); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="velora_club_default_slug"><?php esc_html_e('Default club slug', 'velora-club-widgets'); ?></label>
                </th>
                <td>
                    <input
                        type="text"
                        id="velora_club_default_slug"
                        name="<?php echo esc_attr(Velora_Club_Plugin::OPTION_DEFAULT_SLUG); ?>"
                        value="<?php echo esc_attr(get_option(Velora_Club_Plugin::OPTION_DEFAULT_SLUG, '')); ?>"
                        class="regular-text"
                        placeholder="your-club-slug"
                    />
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="velora_club_api_key"><?php esc_html_e('API key (for contact form)', 'velora-club-widgets'); ?></label>
                </th>
                <td>
                    <input
                        type="password"
                        id="velora_club_api_key"
                        name="<?php echo esc_attr(Velora_Club_Plugin::OPTION_API_KEY); ?>"
                        value="<?php echo esc_attr(get_option(Velora_Club_Plugin::OPTION_API_KEY, '')); ?>"
                        class="regular-text"
                        placeholder="vk_live_..."
                        autocomplete="off"
                    />
                    <p class="description">
                        <?php esc_html_e('Generate in Velora: Settings → Developers → Create API key.', 'velora-club-widgets'); ?>
                    </p>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="velora_club_locale"><?php esc_html_e('Language', 'velora-club-widgets'); ?></label>
                </th>
                <td>
                    <select
                        id="velora_club_locale"
                        name="<?php echo esc_attr(Velora_Club_Plugin::OPTION_LOCALE); ?>"
                    >
                        <?php $velora_club_current_locale = get_option(Velora_Club_Plugin::OPTION_LOCALE, 'pl'); ?>
                        <option value="pl" <?php selected($velora_club_current_locale, 'pl'); ?>>Polski</option>
                        <option value="en" <?php selected($velora_club_current_locale, 'en'); ?>>English</option>
                    </select>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="velora_club_show_credit"><?php esc_html_e('Show "Powered by Velora" link', 'velora-club-widgets'); ?></label>
                </th>
                <td>
                    <?php // Hidden 0 first: an unchecked checkbox posts nothing, so this guarantees the option is saved as off. ?>
                    <input type="hidden" name="<?php echo esc_attr(Velora_Club_Plugin::OPTION_SHOW_CREDIT); ?>" value="0" />
                    <input
                        type="checkbox"
                        id="velora_club_show_credit"
                        name="<?php echo esc_attr(Velora_Club_Plugin::OPTION_SHOW_CREDIT); ?>"
                        value="1"
                        <?php checked(get_option(Velora_Club_Plugin::OPTION_SHOW_CREDIT, false)); ?>
                    />
                    <p class="description">
                        <?php esc_html_e('Off by default. When enabled, a small "Powered by Velora" link is shown under each widget on your public pages.', 'velora-club-widgets'); ?>
                    </p>
                </td>
            </tr>
            <tr class="velora-test-row">
                <td></td>
                <td>
                    <button type="button" id="velora-test-connection" class="button button-secondary">
                        <?php esc_html_e('Test connection', 'velora-club-widgets'); ?>
                    </button>
                    <output id="velora-test-connection-result"></output>
                    <p class="description">
                        <?php esc_html_e('Checks the values entered above without saving them. If they work, click "Save changes".', 'velora-club-widgets'); ?>
                    </p>
                </td>
            </tr>
        </table>

        <?php submit_button(); ?>
    </form>

    <hr>

    <h2><?php esc_html_e('Available shortcodes', 'velora-club-widgets'); ?></h2>
    <ul>
        <li><code>[velora-club-breeders]</code> — <?php esc_html_e('member breeders list', 'velora-club-widgets'); ?></li>
        <li><code>[velora-club-contact]</code> — <?php esc_html_e('contact form — messages are delivered to your club inbox in Velora', 'velora-club-widgets'); ?></li>
    </ul>

    <p>
        <?php esc_html_e('Optional attributes: slug="..." limit="50" theme="auto|light|dark".', 'velora-club-widgets'); ?>
    </p>
</div>
