<?php
/**
 * @package VeloraBreederWidgets
 */

if (!defined('ABSPATH')) {
    exit;
}
?>
<div class="wrap">
    <h1><?php esc_html_e('Velora Breeder Widgets', 'velora-breeder-widgets'); ?></h1>

    <p>
        <?php esc_html_e('Configure the connection to your Velora breeder profile. The API key is required only for contact form submissions; read-only widgets (animals, gallery, listings, posts, events) work without one.', 'velora-breeder-widgets'); ?>
    </p>

    <form method="post" action="options.php">
        <?php settings_fields('velora_breeder'); ?>

        <table class="form-table">
            <tr>
                <th scope="row">
                    <label for="velora_breeder_api_base"><?php esc_html_e('API base URL', 'velora-breeder-widgets'); ?></label>
                </th>
                <td>
                    <input
                        type="url"
                        id="velora_breeder_api_base"
                        name="<?php echo esc_attr(Velora_Breeder_Plugin::OPTION_API_BASE); ?>"
                        value="<?php echo esc_attr(get_option(Velora_Breeder_Plugin::OPTION_API_BASE, 'https://velora.pet')); ?>"
                        class="regular-text"
                        placeholder="https://velora.pet"
                    />
                    <p class="description"><?php esc_html_e('Velora external API base (no trailing slash).', 'velora-breeder-widgets'); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="velora_breeder_profile_base"><?php esc_html_e('Profile base URL', 'velora-breeder-widgets'); ?></label>
                </th>
                <td>
                    <input
                        type="url"
                        id="velora_breeder_profile_base"
                        name="<?php echo esc_attr(Velora_Breeder_Plugin::OPTION_PROFILE_BASE); ?>"
                        value="<?php echo esc_attr(get_option(Velora_Breeder_Plugin::OPTION_PROFILE_BASE, 'https://velora.pet')); ?>"
                        class="regular-text"
                        placeholder="https://velora.pet"
                    />
                    <p class="description"><?php esc_html_e('Public Velora portal URL. Card/row clicks open profiles here.', 'velora-breeder-widgets'); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="velora_breeder_default_slug"><?php esc_html_e('Default breeder slug', 'velora-breeder-widgets'); ?></label>
                </th>
                <td>
                    <input
                        type="text"
                        id="velora_breeder_default_slug"
                        name="<?php echo esc_attr(Velora_Breeder_Plugin::OPTION_DEFAULT_SLUG); ?>"
                        value="<?php echo esc_attr(get_option(Velora_Breeder_Plugin::OPTION_DEFAULT_SLUG, '')); ?>"
                        class="regular-text"
                        placeholder="your-cattery-slug"
                    />
                    <p class="description"><?php esc_html_e('Used when a shortcode omits the slug attribute.', 'velora-breeder-widgets'); ?></p>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="velora_breeder_api_key"><?php esc_html_e('API key (for contact form)', 'velora-breeder-widgets'); ?></label>
                </th>
                <td>
                    <input
                        type="password"
                        id="velora_breeder_api_key"
                        name="<?php echo esc_attr(Velora_Breeder_Plugin::OPTION_API_KEY); ?>"
                        value="<?php echo esc_attr(get_option(Velora_Breeder_Plugin::OPTION_API_KEY, '')); ?>"
                        class="regular-text"
                        placeholder="vk_live_..."
                        autocomplete="off"
                    />
                    <p class="description">
                        <?php esc_html_e('Generate in Velora: Settings → Developers → Create API key. Must start with "vk_live_".', 'velora-breeder-widgets'); ?>
                    </p>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="velora_breeder_locale"><?php esc_html_e('Language', 'velora-breeder-widgets'); ?></label>
                </th>
                <td>
                    <select
                        id="velora_breeder_locale"
                        name="<?php echo esc_attr(Velora_Breeder_Plugin::OPTION_LOCALE); ?>"
                    >
                        <?php $velora_breeder_current_locale = get_option(Velora_Breeder_Plugin::OPTION_LOCALE, 'pl'); ?>
                        <option value="pl" <?php selected($velora_breeder_current_locale, 'pl'); ?>>Polski</option>
                        <option value="en" <?php selected($velora_breeder_current_locale, 'en'); ?>>English</option>
                    </select>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label for="velora_breeder_show_credit"><?php esc_html_e('Show "Powered by Velora" link', 'velora-breeder-widgets'); ?></label>
                </th>
                <td>
                    <?php // Hidden 0 first: an unchecked checkbox posts nothing, so this guarantees the option is saved as off. ?>
                    <input type="hidden" name="<?php echo esc_attr(Velora_Breeder_Plugin::OPTION_SHOW_CREDIT); ?>" value="0" />
                    <input
                        type="checkbox"
                        id="velora_breeder_show_credit"
                        name="<?php echo esc_attr(Velora_Breeder_Plugin::OPTION_SHOW_CREDIT); ?>"
                        value="1"
                        <?php checked(get_option(Velora_Breeder_Plugin::OPTION_SHOW_CREDIT, false)); ?>
                    />
                    <p class="description">
                        <?php esc_html_e('Off by default. When enabled, a small "Powered by Velora" link is shown under each widget on your public pages.', 'velora-breeder-widgets'); ?>
                    </p>
                </td>
            </tr>
            <tr class="velora-test-row">
                <td></td>
                <td>
                    <button type="button" id="velora-test-connection" class="button button-secondary">
                        <?php esc_html_e('Test connection', 'velora-breeder-widgets'); ?>
                    </button>
                    <output id="velora-test-connection-result"></output>
                    <p class="description">
                        <?php esc_html_e('Checks the values entered above without saving them. If they work, click "Save changes".', 'velora-breeder-widgets'); ?>
                    </p>
                </td>
            </tr>
        </table>

        <?php submit_button(); ?>
    </form>

    <hr>

    <h2><?php esc_html_e('Available shortcodes', 'velora-breeder-widgets'); ?></h2>
    <ul>
        <li><code>[velora-breeder-animals]</code> — <?php esc_html_e('current animals grid', 'velora-breeder-widgets'); ?></li>
        <li><code>[velora-breeder-contact]</code> — <?php esc_html_e('contact/inquiry form — messages are delivered to your Velora inbox', 'velora-breeder-widgets'); ?></li>
    </ul>

    <p>
        <?php esc_html_e('Optional attributes: slug="..." limit="12" theme="auto|light|dark". Slug defaults to the value configured above.', 'velora-breeder-widgets'); ?>
    </p>
</div>
